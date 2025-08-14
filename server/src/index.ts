import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => res.send('Bienvenido a FamiPOS API 🚀'));

// Categorias
app.get('/categorias', async (_req, res) => {
  const cats = await prisma.categoria.findMany();
  res.json(cats);
});
app.post('/categorias', async (req, res) => {
  const { nombre } = req.body;
  const cat = await prisma.categoria.create({ data: { nombre } });
  res.status(201).json(cat);
});

// Productos
app.get('/productos', async (_req, res) => {
  const prods = await prisma.producto.findMany({ where: { activo: true }, include: { categoria: true } });
  res.json(prods);
});
app.get('/productos/:id', async (req, res) => {
  const id = Number(req.params.id);
  const p = await prisma.producto.findUnique({ where: { id }, include: { categoria: true } });
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(p);
});
app.post('/productos', async (req, res) => {
  const { nombre, precio, stock, categoriaId } = req.body;
  const p = await prisma.producto.create({ data: { nombre, precio: Number(precio), stock: Number(stock), categoriaId }});
  res.status(201).json(p);
});
app.put('/productos/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { nombre, precio, stock, categoriaId, activo } = req.body;
  try {
    const p = await prisma.producto.update({ where: { id }, data: { nombre, precio: Number(precio), stock: Number(stock), categoriaId, activo }});
    res.json(p);
  } catch (e:any) {
    res.status(404).json({ error: 'Producto no encontrado' });
  }
});
app.delete('/productos/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.producto.update({ where: { id }, data: { activo: false }});
    res.json({ message: 'Producto marcado como inactivo' });
  } catch (e:any) {
    res.status(400).json({ error: 'No se pudo eliminar' });
  }
});

// Ventas y pagos
app.post('/ventas', async (req, res) => {
  try {
    const { productos, pagos } = req.body;
    if (!Array.isArray(productos) || productos.length === 0) return res.status(400).json({ error: 'Productos requeridos' });
    const total = productos.reduce((s:any,p:any)=> s + Number(p.precio)*Number(p.cantidad), 0);
    const venta = await prisma.venta.create({
      data: {
        total,
        productos: { create: productos.map((p:any)=>({ cantidad: Number(p.cantidad), productoId: Number(p.id) })) },
        pagos: { create: pagos.map((pg:any)=>({ metodo: pg.metodo, monto: Number(pg.monto) })) }
      },
      include: { productos: { include: { producto: true } }, pagos: true }
    });
    res.status(201).json(venta);
  } catch (e:any) {
    res.status(400).json({ error: e.message });
  }
});
app.get('/ventas', async (_req, res) => {
  const ventas = await prisma.venta.findMany({ include: { productos: { include: { producto: true } }, pagos: true } });
  res.json(ventas);
});

// Cortes
app.get('/cortes/pendiente', async (_req, res) => {
  const last = await prisma.corte.findFirst({ orderBy: { fecha: 'desc' } });
  const since = last ? last.fecha : new Date(0);
  const ventas = await prisma.venta.findMany({ where: { fecha: { gt: since } }, include: { pagos: true } });
  const totalsByMethod: { [k:string]: number } = {};
  let totalVentas = 0;
  for (const v of ventas) {
    totalVentas += Number(v.total);
    for (const p of v.pagos) {
      totalsByMethod[p.metodo] = (totalsByMethod[p.metodo] || 0) + Number(p.monto);
    }
  }
  res.json({ totalVentas, totalsByMethod, desde: since });
});
app.post('/cortes', async (req, res) => {
  try {
    const { efectivoContado, fondoCaja=0, gastos=0, nota } = req.body;
    const last = await prisma.corte.findFirst({ orderBy: { fecha: 'desc' } });
    const since = last ? last.fecha : new Date(0);
    const ventas = await prisma.venta.findMany({ where: { fecha: { gt: since } }, include: { pagos: true } });
    const totalsByMethod: { [k:string]: number } = {};
    let totalVentas = 0;
    for (const v of ventas) {
      totalVentas += Number(v.total);
      for (const p of v.pagos) {
        totalsByMethod[p.metodo] = (totalsByMethod[p.metodo] || 0) + Number(p.monto);
      }
    }
    const diferencia = Number(efectivoContado) - (totalsByMethod['Efectivo'] || 0) - Number(gastos) + Number(fondoCaja);
    const corte = await prisma.corte.create({
      data: {
        totalVentas,
        efectivoContado: Number(efectivoContado),
        fondoCaja: Number(fondoCaja),
        gastos: Number(gastos),
        diferencia: Number(diferencia),
        detalleJson: JSON.stringify({ totalsByMethod, nota })
      }
    });
    res.status(201).json({ corte, totalsByMethod });
  } catch (e:any) {
    res.status(400).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`FamiPOS server listening on http://localhost:${PORT}`));
