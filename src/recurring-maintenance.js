'use strict';

const { pool, seedHotelRooms, ensurePlanBackup } = require('./db');
const { notify, audit } = require('./notifications');
const { RECURRING_PLAN } = require('./recurring-plan');

const TZ = 'America/Argentina/Cordoba';

async function seedRecurringPlan(client = pool) {
  for (const item of RECURRING_PLAN) {
    await client.query(
      `INSERT INTO mantenimiento_rutinas(clave,titulo,frecuencia,instrucciones,checklist)
       VALUES($1,$2,$3,$4,$5::jsonb)
       ON CONFLICT(clave) DO UPDATE SET
         titulo=EXCLUDED.titulo,
         frecuencia=EXCLUDED.frecuencia,
         instrucciones=EXCLUDED.instrucciones,
         checklist=EXCLUDED.checklist`,
      [item.key, item.title, item.frequency, item.instructions || '', JSON.stringify(item.checklist || [])]
    );
  }
}

function checklistText(items) {
  return items.length ? `\n\nChecklist informado por el hotel:\n${items.map((x, i) => `${i + 1}. ${x}`).join('\n')}` : '';
}

async function currentPeriods() {
  const result = await pool.query(
    `SELECT
      (now() AT TIME ZONE $1)::date AS hoy,
      date_trunc('month',now() AT TIME ZONE $1)::date AS mes,
      date_trunc('week',now() AT TIME ZONE $1)::date AS semana`,
    [TZ]
  );
  return result.rows[0];
}

async function syncRecurringMaintenance() {
  await ensurePlanBackup();
  await seedHotelRooms();
  await seedRecurringPlan();
  const periods = await currentPeriods();
  const plans = await pool.query('SELECT * FROM mantenimiento_rutinas WHERE activo ORDER BY id');
  const managers = await pool.query("SELECT id FROM usuarios WHERE activo AND rol IN ('jefe_mantenimiento','admin')");

  for (const plan of plans.rows) {
    const period = plan.frecuencia === 'semanal' ? periods.semana : periods.mes;
    const dueExpression = plan.frecuencia === 'semanal' ? "$2::date + interval '7 days'" : "$2::date + interval '1 month'";
    const checklist = Array.isArray(plan.checklist) ? plan.checklist : [];
    const client = await pool.connect();
    let alert;
    try {
      await client.query('BEGIN');
      const occurrence = await client.query(
        `INSERT INTO mantenimiento_rutina_ejecuciones(plan_id,periodo)
         VALUES($1,$2) ON CONFLICT(plan_id,periodo) DO NOTHING RETURNING id`,
        [plan.id, period]
      );
      if (!occurrence.rows[0]) {
        await client.query('ROLLBACK');
        continue;
      }
      const description = `Rutina ${plan.frecuencia} Böden · período ${period}. Asignar responsable, completar el trabajo y adjuntar evidencia.${checklistText(checklist)}`;
      const created = await client.query(
        `INSERT INTO alertas(numero,titulo,descripcion,prioridad,estado,vence_at)
         VALUES(nextval('alerta_numero_seq'),$1,$3,'media','nueva',(${dueExpression} AT TIME ZONE $4))
         RETURNING id,numero,titulo`,
        [plan.titulo, period, description, TZ]
      );
      alert = created.rows[0];
      await client.query('UPDATE mantenimiento_rutina_ejecuciones SET alerta_id=$1 WHERE id=$2', [alert.id, occurrence.rows[0].id]);
      await client.query(
        `INSERT INTO alerta_historial(alerta_id,evento,nota)
         VALUES($1,'Tarea creada desde el plan preventivo',$2)`,
        [alert.id, `${plan.frecuencia} · ${period}`]
      );
      await audit(client, 'mantenimiento_rutina', plan.id, 'tarea_recurrente_creada', null, { periodo: period, alerta_id: alert.id });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    await notify(managers.rows.map(x => x.id), {
      key: `plan-rutina-${plan.id}-${period}`,
      title: 'Tarea preventiva programada',
      body: `${plan.titulo} · ${plan.frecuencia}`,
      url: `/?alerta=${alert.id}`,
    });
  }
}

async function listRecurringPlan() {
  const periods = await currentPeriods();
  const result = await pool.query(
    `SELECT p.id,p.clave,p.titulo,p.frecuencia,p.instrucciones,p.checklist,p.activo,
      e.periodo,e.alerta_id,a.estado,a.numero,a.vence_at
     FROM mantenimiento_rutinas p
     LEFT JOIN mantenimiento_rutina_ejecuciones e ON e.plan_id=p.id AND e.periodo=CASE WHEN p.frecuencia='semanal' THEN $1::date ELSE $2::date END
     LEFT JOIN alertas a ON a.id=e.alerta_id
     ORDER BY p.id`,
    [periods.semana, periods.mes]
  );
  return { today: periods.hoy, week: periods.semana, month: periods.mes, plans: result.rows };
}

module.exports = { seedRecurringPlan, syncRecurringMaintenance, listRecurringPlan };

