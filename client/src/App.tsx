import React, { useEffect, useState, useRef } from 'react';
import { Tabs, Layout, Table, Button, Modal, Form, Input, InputNumber, Select, message, Row, Col, Card, List } from 'antd';
const { Header, Content } = Layout;

const API = 'http://localhost:4000';

export default function App(){
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [ventas, setVentas] = useState([]);

  const [catModal, setCatModal] = useState(false);
  const [prodModal, setProdModal] = useState(false);
  const [corteModal, setCorteModal] = useState(false);

  const [formCat] = Form.useForm();
  const [formProd] = Form.useForm();

  const [cartItems, setCartItems] = useState([]);
  const idInputRef = useRef(null);

  useEffect(()=>{ fetchAll() },[]);

  async function fetchAll(){
    try{
      const r1 = await fetch(API + '/categorias'); setCategorias(await r1.json());
      const r2 = await fetch(API + '/productos'); setProductos(await r2.json());
      const r3 = await fetch(API + '/ventas'); setVentas(await r3.json());
    }catch(e){ message.error('Error cargando datos'); }
  }

  async function createCategoria(values){
    await fetch(API + '/categorias', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(values)});
    message.success('Categoría creada'); setCatModal(false); formCat.resetFields(); fetchAll();
  }
  async function createProducto(values){
    await fetch(API + '/productos', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(values)});
    message.success('Producto creado'); setProdModal(false); formProd.resetFields(); fetchAll();
  }

  async function addById(raw){
    const id = Number(raw);
    if (!id) { message.error('ID inválido'); return; }
    try {
      const res = await fetch(API + '/productos/' + id);
      if (!res.ok) { message.error('Producto no encontrado'); return; }
      const p = await res.json();
      setCartItems(prev=>{
        const found = prev.find(i=>i.id===p.id);
        if(found) return prev.map(i=> i.id===p.id? {...i, cantidad: i.cantidad+1}: i);
        return [...prev, { id: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1 }];
      });
      if (idInputRef.current) idInputRef.current.value = '';
    } catch (e){ message.error('Error buscando producto'); }
  }

  function updateQty(id, qty){
    setCartItems(prev => prev.map(i=> i.id===id? {...i, cantidad: qty}: i));
  }
  function removeItem(id){
    setCartItems(prev=> prev.filter(i=> i.id!==id));
  }

  async function finishSaleWithPayment(pagos){
    if(cartItems.length===0){ message.info('Carrito vacío'); return; }
    const productos = cartItems.map(i=> ({ id:i.id, precio:i.precio, cantidad:i.cantidad }));
    const res = await fetch(API + '/ventas', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ productos, pagos })});
    if(res.ok){ const data = await res.json(); message.success('Venta registrada'); setCartItems([]); fetchAll(); printSale(data); }
    else { const err = await res.json(); message.error(err.error || 'Error en venta'); }
  }

  function printSale(venta){
    const w = window.open('','_blank');
    if(!w) return;
    const html = `<html><head><title>Ticket</title></head><body style="font-family:monospace; width:280px;">
    <div style="text-align:center;"><h3>FamiPOS</h3><div>Zumpango, Estado de México</div><hr/></div>
    <div>Fecha: ${new Date(venta.fecha).toLocaleString()}</div>
    <table style="width:100%;border-collapse:collapse"><tr><th>ID</th><th>Prod</th><th>Cant</th><th>P.Unit</th><th>Total</th></tr>
    ${venta.productos.map(vp=> '<tr><td>'+vp.producto.id+'</td><td>'+vp.producto.nombre+'</td><td>'+vp.cantidad+'</td><td>'+vp.producto.precio+'</td><td>'+ (vp.producto.precio*vp.cantidad) +'</td></tr>').join('')}
    </table>
    <hr/>
    <div>Total: ${venta.total}</div>
    <div style="text-align:center;margin-top:10px;">Gracias por su compra</div>
    <script>window.print();</script>
    </body></html>`;
    w.document.write(html); w.document.close();
  }

  async function handleCashPayment(){
    // show AntD modal with input for recibido and show change, then call finishSaleWithPayment
    let total = cartItems.reduce((s,i)=> s + i.precio * i.cantidad, 0);
    Modal.info({
      title: 'Pago en efectivo',
      content: (
        <div>
          <div>Total: ${total.toFixed(2)}</div>
          <div style={{marginTop:8}}>Ingrese cantidad recibida:</div>
          <InputNumber style={{width:'100%'}} min={0} onChange={()=>{}} />
          <div style={{marginTop:8}}>Cambio: ...</div>
        </div>
      ),
      onOk(){ /* for simplicity, prompt for amount then proceed */ 
        const val = Number(prompt('Cantidad recibida:',''));
        if(!val || isNaN(val)){ message.error('Monto inválido'); return; }
        const cambio = val - total;
        Modal.info({ title:'Cambio', content:`Total: ${total.toFixed(2)} - Cambio: ${cambio.toFixed(2)}`, onOk: ()=> finishSaleWithPayment([{metodo:'Efectivo', monto: total}]) })
      },
      centered: true
    });
  }

  return (
    <Layout style={{minHeight:'100vh'}}>
      <Header style={{color:'white'}}>FamiPOS</Header>
      <Content style={{padding:20}}>
        <Tabs defaultActiveKey="3">
          <Tabs.TabPane tab="Categorías" key="1">
            <Row gutter={16}>
              <Col span={8}>
                <Card title="Listado" extra={<Button onClick={()=> setCatModal(true)} type="primary">Nueva</Button>}>
                  <List dataSource={categorias} renderItem={c=> <List.Item>{c.nombre}</List.Item>} />
                </Card>
                <Modal open={catModal} onCancel={()=> setCatModal(false)} onOk={()=> formCat.submit()}>
                  <Form form={formCat} onFinish={createCategoria} layout="vertical">
                    <Form.Item name="nombre" label="Nombre" rules={[{required:true}]}><Input/></Form.Item>
                  </Form>
                </Modal>
              </Col>
              <Col span={16}>
                <Card title="Ventas recientes">
                  <List dataSource={ventas} renderItem={v=> <List.Item>#{v.id} - Total: {v.total}</List.Item>} />
                </Card>
              </Col>
            </Row>
          </Tabs.TabPane>

          <Tabs.TabPane tab="Productos" key="2">
            <Row>
              <Col span={24}>
                <Card extra={<Button onClick={()=> setProdModal(true)} type="primary">Nuevo</Button>}>
                  <Table dataSource={productos} columns={[
                    {title:'ID', dataIndex:'id', key:'id'},
                    {title:'Nombre', dataIndex:'nombre', key:'nombre'},
                    {title:'Categoria', dataIndex:['categoria','nombre'], key:'cat'},
                    {title:'Precio', dataIndex:'precio', key:'precio'},
                    {title:'Stock', dataIndex:'stock', key:'stock'}
                  ]} rowKey="id" />
                </Card>
                <Modal open={prodModal} onCancel={()=> setProdModal(false)} onOk={()=> formProd.submit()}>
                  <Form form={formProd} onFinish={createProducto} layout="vertical">
                    <Form.Item name="nombre" label="Nombre" rules={[{required:true}]}><Input/></Form.Item>
                    <Form.Item name="categoriaId" label="Categoría" rules={[{required:true}]}>
                      <Select options={categorias.map(c=>({label:c.nombre, value:c.id}))} />
                    </Form.Item>
                    <Form.Item name="precio" label="Precio" rules={[{required:true}]}><InputNumber min={0} style={{width:'100%'}}/></Form.Item>
                    <Form.Item name="stock" label="Stock" rules={[{required:true}]}><InputNumber min={0} style={{width:'100%'}}/></Form.Item>
                  </Form>
                </Modal>
              </Col>
            </Row>
          </Tabs.TabPane>

          <Tabs.TabPane tab="Ventas" key="3">
            <Row gutter={16}>
              <Col span={16}>
                <Card title="Venta - Ingresar ID">
                  <div style={{display:'flex', gap:8, marginBottom:8}}>
                    <input ref={idInputRef} placeholder="Ingrese ID y presione Enter" onKeyDown={(e)=>{ if(e.key==='Enter') addById(e.target.value)}} style={{flex:1, padding:8}}/>
                    <Button onClick={()=> { if(idInputRef.current) addById(idInputRef.current.value) }}>Agregar</Button>
                    <Button danger onClick={()=> setCartItems([])}>Limpiar</Button>
                  </div>
                  <Table dataSource={cartItems} columns={[
                    {title:'ID', dataIndex:'id', key:'id'},
                    {title:'Producto', dataIndex:'nombre', key:'nombre'},
                    {title:'Cantidad', key:'cantidad', render: (_:any, r:any)=>(<InputNumber min={1} value={r.cantidad} onChange={(v)=> updateQty(r.id, Number(v))}/> )},
                    {title:'P.Unit', dataIndex:'precio', key:'precio'},
                    {title:'Total', key:'total', render: (_:any, r:any)=>(r.precio * r.cantidad)},
                    {title:'Acciones', key:'acc', render: (_:any, r:any)=>(<Button danger onClick={()=> removeItem(r.id)}>Quitar</Button>)}
                  ]} rowKey="id" pagination={false}/>
                  <div style={{marginTop:10, textAlign:'right'}}>Total: <b>{cartItems.reduce((s,i)=> s + i.precio * i.cantidad, 0)}</b></div>
                  <div style={{marginTop:10, display:'flex', gap:8}}>
                    <Select style={{width:200}} defaultValue="Efectivo" options={[
                      {label:'Efectivo', value:'Efectivo'},
                      {label:'Tarjeta - Débito', value:'Tarjeta Débito'},
                      {label:'Tarjeta - Crédito', value:'Tarjeta Crédito'}
                    ]} onChange={(v)=> { /* no-op */ }} />
                    <Button type="primary" onClick={handleCashPayment}>Cobrar</Button>
                    <Button onClick={()=> setCorteModal(true)}>Corte</Button>
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card title="Resumen">
                  <List dataSource={cartItems} renderItem={it=> <List.Item>{it.nombre} x {it.cantidad} - {it.precio * it.cantidad}</List.Item>} />
                </Card>
              </Col>
            </Row>
            <Modal open={corteModal} onCancel={()=> setCorteModal(false)} footer={null} title="INFORMACIÓN DEL CORTE">
              <CorteModalContent onClose={()=> { setCorteModal(false); fetchAll(); }} />
            </Modal>
          </Tabs.TabPane>
        </Tabs>
      </Content>
    </Layout>
  )
}

function CorteModalContent({ onClose }){
  const [totales, setTotales] = useState({});
  const [efectivo, setEfectivo] = useState(0);
  const [fondo, setFondo] = useState(0);
  const [gastos, setGastos] = useState(0);
  const [nota, setNota] = useState('');

  useEffect(()=>{ fetchPendiente() },[]);

  async function fetchPendiente(){
    const res = await fetch(API + '/cortes/pendiente');
    const j = await res.json();
    setTotales(j.totalsByMethod || {});
  }

  async function registrar(){
    const res = await fetch(API + '/cortes', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ efectivoContado: efectivo, fondoCaja: fondo, gastos, nota })});
    if(res.ok){
      const data = await res.json();
      alert('Corte registrado');
      printCorte(data);
      onClose();
    } else {
      const err = await res.json();
      message.error(err.error || 'Error en corte');
    }
  }

  function printCorte(data){
    const w = window.open('','_blank');
    if(!w) return;
    const corte = data.corte;
    const totals = data.totalsByMethod;
    const html = `<html><body style="font-family:monospace; width:280px;">
    <div style="text-align:center;"><h3>FamiPOS</h3><div>Zumpango, Estado de México</div><hr/></div>
    <div>Total Ventas: ${corte.totalVentas}</div>
    <div>Totales por método: ${Object.entries(totals).map(([k,v])=> '<div>'+k+': '+v+'</div>').join('')}</div>
    <div>Fondo Caja: ${corte.fondoCaja}</div>
    <div>Gastos: ${corte.gastos}</div>
    <div>Efectivo contado: ${corte.efectivoContado}</div>
    <div>Diferencia: ${corte.diferencia}</div>
    <div style="text-align:center;margin-top:10px;">Gracias por su compra</div>
    <script>window.print();</script>
    </body></html>`;
    w.document.write(html); w.document.close();
  }

  return (
    <div>
      <div style={{display:'flex', gap:8}}>
        <div style={{flex:1}}>
          <h4>Totales por método</h4>
          <ul>
            {Object.entries(totales).map(([k,v])=> <li key={k}>{k}: {v}</li>)}
          </ul>
        </div>
        <div style={{width:200}}>
          <h4>Fondo de caja</h4>
          <InputNumber style={{width:'100%'}} value={fondo} onChange={(v)=> setFondo(Number(v))}/>
          <h4>Gastos</h4>
          <InputNumber style={{width:'100%'}} value={gastos} onChange={(v)=> setGastos(Number(v))}/>
          <h4>Efectivo contado</h4>
          <InputNumber style={{width:'100%'}} value={efectivo} onChange={(v)=> setEfectivo(Number(v))}/>
        </div>
      </div>
      <div style={{marginTop:16}}>
        <Input placeholder="Nota" value={nota} onChange={(e)=> setNota(e.target.value)} />
      </div>
      <div style={{marginTop:16, textAlign:'right'}}>
        <Button onClick={registrar} type="primary">Registrar</Button>
      </div>
    </div>
  )
}
