'use strict';

const { pool } = require('./db');
const { notify, audit } = require('./notifications');
const { ANNUAL_PLAN, MONTHS } = require('./annual-plan');

async function seedAnnualPlan(client = pool) {
  for (const item of ANNUAL_PLAN) {
    await client.query(
      `INSERT INTO mantenimiento_anual(clave,titulo,meses)
       VALUES($1,$2,$3::smallint[]) ON CONFLICT(clave) DO NOTHING`,
      [item.key, item.title, item.months]
    );
  }
}

async function syncAnnualMaintenance() {
  await seedAnnualPlan();
  const period = await pool.query(`SELECT
    EXTRACT(YEAR FROM now() AT TIME ZONE 'America/Argentina/Cordoba')::int AS anio,
    EXTRACT(MONTH FROM now() AT TIME ZONE 'America/Argentina/Cordoba')::int AS mes`);
  const { anio, mes } = period.rows[0];
  const plans = await pool.query(
    'SELECT * FROM mantenimiento_anual WHERE activo AND meses @> ARRAY[$1]::smallint[] ORDER BY id',
    [mes]
  );
  const managers = await pool.query("SELECT id FROM usuarios WHERE activo AND rol IN ('jefe_mantenimiento','admin')");

  for (const plan of plans.rows) {
    const client = await pool.connect();
    let alerta;
    try {
      await client.query('BEGIN');
      const occurrence = await client.query(
        `INSERT INTO mantenimiento_anual_ejecuciones(plan_id,anio,mes)
         VALUES($1,$2,$3) ON CONFLICT(plan_id,anio,mes) DO NOTHING RETURNING id`,
        [plan.id, anio, mes]
      );
      if (!occurrence.rows[0]) {
        await client.query('ROLLBACK');
        continue;
      }
      const created = await client.query(
        `INSERT INTO alertas(numero,titulo,descripcion,prioridad,estado,vence_at)
         VALUES(nextval('alerta_numero_seq'),$1,$2,'media','nueva',
           ((make_date($3,$4,1)+interval '1 month') AT TIME ZONE 'America/Argentina/Cordoba'))
         RETURNING id,numero,titulo`,
        [plan.titulo, `Plan anual Böden · ${MONTHS[mes - 1]} ${anio}. Asignar responsable y documentar el trabajo con evidencia.`, anio, mes]
      );
      alerta = created.rows[0];
      await client.query('UPDATE mantenimiento_anual_ejecuciones SET alerta_id=$1 WHERE id=$2', [alerta.id, occurrence.rows[0].id]);
      await client.query(
        `INSERT INTO alerta_historial(alerta_id,evento,nota)
         VALUES($1,'Tarea creada desde el plan anual',$2)`,
        [alerta.id, `${MONTHS[mes - 1]} ${anio}`]
      );
      await audit(client, 'mantenimiento_anual', plan.id, 'tarea_mensual_creada', null, { anio, mes, alerta_id: alerta.id });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    await notify(managers.rows.map(x => x.id), {
      key: `plan-anual-${plan.id}-${anio}-${mes}`,
      title: 'Tarea del plan anual',
      body: `${MONTHS[mes - 1]} · ${alerta.titulo}`,
      url: `/?alerta=${alerta.id}`,
    });
  }
}

async function listAnnualPlan(year) {
  const safeYear = Number.isInteger(Number(year)) && Number(year) >= 2020 && Number(year) <= 2200
    ? Number(year)
    : Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Argentina/Cordoba' }).format(new Date()));
  const result = await pool.query(
    `SELECT p.id,p.clave,p.titulo,p.meses,p.instrucciones,p.activo,
      COALESCE(json_agg(json_build_object('mes',e.mes,'alerta_id',e.alerta_id,'estado',a.estado,'numero',a.numero)
        ORDER BY e.mes) FILTER (WHERE e.id IS NOT NULL),'[]'::json) AS ejecuciones
     FROM mantenimiento_anual p
     LEFT JOIN mantenimiento_anual_ejecuciones e ON e.plan_id=p.id AND e.anio=$1
     LEFT JOIN alertas a ON a.id=e.alerta_id
     GROUP BY p.id ORDER BY p.id`,
    [safeYear]
  );
  return { year: safeYear, months: MONTHS, plans: result.rows };
}

module.exports = { seedAnnualPlan, syncAnnualMaintenance, listAnnualPlan };

