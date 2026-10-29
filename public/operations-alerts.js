'use strict';
(function(OS){
 const {S,E,I,api,modal,field,textarea,select,opts,toast,isManager,isMaint,badge,fdate,humanText}=OS;
 const grid=(...items)=>'<div class="form-grid">'+items.join('')+'</div>';
 const call=(path,body,method='POST')=>api(path,{method,body:JSON.stringify(body)});
 const e=x=>E(x??'—');
 const date=x=>fdate(x,true);
 const imageFile=async file=>{
   if(!file || !file.size)return null;
   if(!file.type.startsWith('image/'))throw Error('Solo se admiten imágenes.');
   if(file.size>2500000)throw Error('La fotografía supera 2,5 MB; reducí su tamaño.');
   return new Promise((resolve,reject)=>{
     const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(Error('No se pudo leer la imagen'));r.readAsDataURL(file);
   });
 };
 OS.actions.newAlert=async()=>{
   const catalog=S.cat||await api('/catalogos');S.cat=catalog;
   const equipment=isMaint()?await api('/equipos'):[];
   modal('Nueva incidencia',grid(
     field('¿Qué problema encontraste? *','titulo','text','','required minlength="3"'),
     select('Urgencia','prioridad',['urgente','alta','media','baja'],'media'),
     select('Habitación o sector *','ubicacion_id',(catalog.ubicaciones||[]).map(x=>[x.id,x.nombre])),
     select('Tipo de incidencia','categoria_id',opts(catalog.categorias,'Sin categoría')),
     (equipment.length?select('Equipo o instalación (opcional)','equipo_id',opts(equipment,'Sin equipo asociado')):''),
     textarea('Descripción del desperfecto','descripcion'),
     '<div class="field span2"><label>Fotografía (opcional, máx. 2,5 MB)</label><input type="file" name="archivo_foto" accept="image/*" capture="environment"></div>',
     (isManager()?'<div class="field span2"><label class="check-line"><input type="checkbox" name="vip" value="true"><span>Área sensible / habitación VIP</span></label></div>':'')
   ),async(b,form)=>{
     if(!b.ubicacion_id)throw Error('Seleccioná el lugar de la incidencia');
     const file=form.querySelector('input[name="archivo_foto"]')?.files?.[0];
     const foto=await imageFile(file);
     return call('/alertas',{titulo:b.titulo,prioridad:b.prioridad,ubicacion_id:Number(b.ubicacion_id),categoria_id:b.categoria_id?Number(b.categoria_id):null,equipo_id:b.equipo_id?Number(b.equipo_id):null,descripcion:b.descripcion,foto,vip:b.vip==='true'});
   },'Registrar incidencia');
 };
 OS.actions.alertDetail=async(id)=>{
   const a=await api('/alertas/'+id);
   const history=await api('/alertas/'+id+'/historial');
   const detail=(label,value)=>'<div class="detail"><small>'+E(label)+'</small><strong>'+e(value)+'</strong></div>';
   const notes=(history||[]).length?history.map(x=>
     '<div class="activity"><div class="activity-symbol">'+I('clock')+'</div><div class="activity-main"><strong>'+e(x.evento)+'</strong><small>'+e(x.usuario_nombre||'Sistema')+' · '+date(x.created_at)+(x.nota?' · '+e(x.nota):'')+'</small></div></div>'
   ).join(''):'<p class="muted small">Sin movimientos todavía.</p>';
   const gallery=(a.adjuntos||[]).filter(x=>typeof x.url==='string'&&x.url.startsWith('data:image/')).map(x=>
     '<div class="incident-photo"><img src="'+E(x.url)+'" alt="Fotografía de '+E(x.tipo)+'" loading="lazy"><span>'+e(x.tipo)+'</span></div>'
   ).join('');
   const actions='<div class="row-actions incident-actions">'+
     (isMaint()&&a.estado==='nueva'?'<button class="btn btn-primary" data-action="alertTake" data-id="'+id+'">Tomar aviso</button>':'')+
     (isMaint()&&a.estado==='asignada'?'<button class="btn btn-primary" data-action="alertStart" data-id="'+id+'">Iniciar reparación</button>':'')+
     (isMaint()&&a.estado==='en_proceso'?'<button class="btn btn-primary" data-action="alertResolve" data-id="'+id+'">Marcar resuelta</button>':'')+
     (isManager()&&a.estado==='resuelta'?'<button class="btn btn-primary" data-action="alertClose" data-id="'+id+'">Aprobar cierre</button><button class="btn btn-danger" data-action="alertReject" data-id="'+id+'">Rechazar</button>':'')+
     (isManager()?'<button class="btn btn-soft" data-action="alertAssign" data-id="'+id+'">Asignar técnico</button>':'')+
     (isMaint()?'<button class="btn btn-soft" data-action="newWorkForAlert" data-id="'+id+'">Registrar trabajo</button>':'')+
     '</div>';
   modal(a.codigo+' · '+a.titulo,'<div class="detail-grid">'+[
     detail('Estado',OS.status(a.estado)),detail('Urgencia',OS.status(a.prioridad)),
     detail('Ubicación',a.ubicacion),detail('Reportado por',a.reportado_nombre),
     detail('Asignado a',a.asignado_nombre||'Pendiente'),detail('Equipo',a.equipo_nombre?(a.equipo_codigo+' · '+a.equipo_nombre):'Sin asociar'),
     detail('Vence',a.vence_at?date(a.vence_at):'Sin plazo'),detail('Fecha',date(a.created_at)),
     ...(a.verificada_at?[detail('Verificó',a.verificado_nombre||'Supervisión'),detail('Resultado de revisión',a.verificacion_nota||'Aprobado')]:[])
   ].join('')+'</div><div class="overline section-label">DESCRIPCIÓN</div><div class="detail-desc">'+e(humanText(a.descripcion))+'</div>'+
    (gallery?'<div class="overline section-label">FOTOGRAFÍAS</div><div class="incident-gallery">'+gallery+'</div>':'')+
    '<div class="overline section-label">HISTORIAL DE LA INCIDENCIA</div><div class="incident-history">'+notes+'</div>'+actions,null);
 };
 OS.actions.alertAssign=async(id)=>{
   if(!isManager())throw Error('Solo jefatura puede asignar avisos');
   OS.close();const catalog=S.cat||await api('/catalogos');S.cat=catalog;
   const available=catalog.operarios||[];if(!available.length)throw Error('Primero registrá técnicos activos desde Personal y permisos');
   modal('Asignar técnico y plazo',grid(
     select('Responsable de la reparación','asignado_a',available.map(x=>[x.id,x.nombre])),
     field('Fecha y hora límite','vence_at','datetime-local','','required')
   ),b=>call('/alertas/'+id+'/asignar',{asignado_a:Number(b.asignado_a),vence_at:b.vence_at},'PATCH'),'Asignar');
 };
})(window.OS);
