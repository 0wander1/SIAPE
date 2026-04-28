export const mockClientes = [
  { id: 1, nombre: 'Supermercado La Especial', correo: 'compras@laespecial.com' },
  { id: 2, nombre: 'Distribuidora Norte Ltda', correo: 'pedidos@norte.com' },
  { id: 3, nombre: 'Comercial El Éxito', correo: 'logistica@exito.com' },
  { id: 4, nombre: 'Tienda La Esperanza', correo: 'tienda@esperanza.com' },
  { id: 5, nombre: 'Corporación Alimentaria SAS', correo: 'ceo@corpali.com' },
];

export const mockTrabajadores = [
  { id: 1, nombre: 'Carlos Ramírez', cargo: 'Bodeguero', direccion: 'Cra 5 #10-20', turno: 'Mañana', celular: '3001234567', username: 'caramirez' },
  { id: 2, nombre: 'Laura Gómez', cargo: 'Vendedora', direccion: 'Cll 15 #8-45', turno: 'Tarde', celular: '3119876543', username: 'lauragomez' },
  { id: 3, nombre: 'Andrés Torres', cargo: 'Repartidor', direccion: 'Av 30 #22-10', turno: 'Completo', celular: '3207654321', username: 'andtorres' },
  { id: 4, nombre: 'María Pérez', cargo: 'Contadora', direccion: 'Cra 12 #45-67', turno: 'Mañana', celular: '3154567890', username: 'mariaperez' },
];

export const mockProveedores = [
  { id: 1, nombre: 'Lácteos del Valle SAS', nit: '900123456-1', pedidosPorEntregar: 2, fechaPedidoPendiente: '2026-04-28', idUsuario: 1 },
  { id: 2, nombre: 'Granos y Cereales Ltda', nit: '800234567-2', pedidosPorEntregar: 1, fechaPedidoPendiente: '2026-04-27', idUsuario: 2 },
  { id: 3, nombre: 'Frutas Frescas SA', nit: '700345678-3', pedidosPorEntregar: 3, fechaPedidoPendiente: '2026-04-29', idUsuario: 3 },
  { id: 4, nombre: 'Carnes y Embutidos Nacional', nit: '600456789-4', pedidosPorEntregar: 0, fechaPedidoPendiente: null, idUsuario: 1 },
];

export const mockBodegas = [
  { id: 1, descripcion: 'Bodega Principal', ubicacion: 'Cra 10 #20-30', ciudad: 'Bogotá', capacidadMaxima: 1000, capacidadActual: 750, tipo: 'Refrigerada', estado: 'Activa' },
  { id: 2, descripcion: 'Bodega Secundaria', ubicacion: 'Cll 50 #15-20', ciudad: 'Medellín', capacidadMaxima: 500, capacidadActual: 200, tipo: 'Seca', estado: 'Activa' },
  { id: 3, descripcion: 'Punto Satélite Norte', ubicacion: 'Av 68 #100-10', ciudad: 'Bogotá', capacidadMaxima: 300, capacidadActual: 290, tipo: 'Seca', estado: 'Activa' },
];

export const mockInventario = [
  { id: 'P001', nombre: 'Leche Entera 1L', idBodega: 1, cantidadDisponible: 450, cantidadReservada: 50, cantidadMinima: 100, ultimaActualizacion: '2026-04-26', proveedor: 'Lácteos del Valle SAS' },
  { id: 'P002', nombre: 'Arroz Blanco 5kg', idBodega: 1, cantidadDisponible: 85, cantidadReservada: 20, cantidadMinima: 100, ultimaActualizacion: '2026-04-25', proveedor: 'Granos y Cereales Ltda' },
  { id: 'P003', nombre: 'Aceite Vegetal 3L', idBodega: 2, cantidadDisponible: 200, cantidadReservada: 30, cantidadMinima: 50, ultimaActualizacion: '2026-04-26', proveedor: 'Granos y Cereales Ltda' },
  { id: 'P004', nombre: 'Manzana Roja x kg', idBodega: 1, cantidadDisponible: 40, cantidadReservada: 10, cantidadMinima: 80, ultimaActualizacion: '2026-04-24', proveedor: 'Frutas Frescas SA' },
  { id: 'P005', nombre: 'Queso Campesino 500g', idBodega: 1, cantidadDisponible: 60, cantidadReservada: 15, cantidadMinima: 50, ultimaActualizacion: '2026-04-27', proveedor: 'Lácteos del Valle SAS' },
  { id: 'P006', nombre: 'Salchichón Corriente 1kg', idBodega: 3, cantidadDisponible: 30, cantidadReservada: 5, cantidadMinima: 40, ultimaActualizacion: '2026-04-26', proveedor: 'Carnes y Embutidos Nacional' },
];

export const mockPedidos = [
  { id: 'PED-001', cliente: 'Supermercado La Especial', producto: 'Leche Entera 1L', cantidad: 100, estado: 'Entregado', valorTotal: 350000, direccion: 'Cra 5 #10-20, Bogotá', fechaEstimada: '2026-04-20', fechaReal: '2026-04-20', observaciones: '' },
  { id: 'PED-002', cliente: 'Distribuidora Norte Ltda', producto: 'Arroz Blanco 5kg', cantidad: 50, estado: 'Pendiente', valorTotal: 575000, direccion: 'Cll 15 #8-45, Bogotá', fechaEstimada: '2026-04-27', fechaReal: null, observaciones: 'Entregar antes del mediodía' },
  { id: 'PED-003', cliente: 'Comercial El Éxito', producto: 'Aceite Vegetal 3L', cantidad: 80, estado: 'En tránsito', valorTotal: 640000, direccion: 'Av 30 #22-10, Medellín', fechaEstimada: '2026-04-27', fechaReal: null, observaciones: '' },
  { id: 'PED-004', cliente: 'Tienda La Esperanza', producto: 'Manzana Roja x kg', cantidad: 30, estado: 'Pendiente', valorTotal: 90000, direccion: 'Cra 12 #45-67, Bogotá', fechaEstimada: '2026-04-28', fechaReal: null, observaciones: 'Llamar antes de despachar' },
  { id: 'PED-005', cliente: 'Corporación Alimentaria SAS', producto: 'Queso Campesino 500g', cantidad: 40, estado: 'Cancelado', valorTotal: 280000, direccion: 'Av 68 #100-10, Bogotá', fechaEstimada: '2026-04-22', fechaReal: null, observaciones: 'Cliente canceló por stock insuficiente' },
];

export const mockFacturas = [
  { id: 1, numeroFactura: 'F-2026-001', fechaEmision: '2026-04-20', fechaVencimiento: '2026-05-20', subtotal: 294118, impuesto: 55882, descuento: 0, total: 350000, estado: 'Pagada', idPedido: 'PED-001' },
  { id: 2, numeroFactura: 'F-2026-002', fechaEmision: '2026-04-24', fechaVencimiento: '2026-05-24', subtotal: 483193, impuesto: 91807, descuento: 0, total: 575000, estado: 'Pendiente', idPedido: 'PED-002' },
  { id: 3, numeroFactura: 'F-2026-003', fechaEmision: '2026-04-26', fechaVencimiento: '2026-05-26', subtotal: 537815, impuesto: 102185, descuento: 0, total: 640000, estado: 'Pendiente', idPedido: 'PED-003' },
  { id: 4, numeroFactura: 'F-2026-004', fechaEmision: '2026-04-27', fechaVencimiento: '2026-05-27', subtotal: 75630, impuesto: 14370, descuento: 0, total: 90000, estado: 'Borrador', idPedido: 'PED-004' },
];

export const mockPagos = [
  { id: 1, idFactura: 'F-2026-001', monto: 350000, fecha: '2026-04-21', metodo: 'Transferencia', referencia: 'TRF-20260421-001', registradoPor: 'María Pérez' },
  { id: 2, idFactura: 'F-2026-002', monto: 200000, fecha: '2026-04-25', metodo: 'Efectivo', referencia: 'EFE-20260425-001', registradoPor: 'Laura Gómez' },
];

export const mockProductosVencer = [
  { id: 'P001', nombre: 'Leche Entera 1L', fechaVencimiento: '2026-05-05', stock: 120, diasRestantes: 8 },
  { id: 'P004', nombre: 'Manzana Roja x kg', fechaVencimiento: '2026-05-02', stock: 40, diasRestantes: 5 },
  { id: 'P006', nombre: 'Salchichón Corriente 1kg', fechaVencimiento: '2026-04-30', stock: 30, diasRestantes: 3 },
];

export const mockVentasSemana = [
  { semana: 'Sem 1', ventas: 1850000 },
  { semana: 'Sem 2', ventas: 2340000 },
  { semana: 'Sem 3', ventas: 1980000 },
  { semana: 'Sem 4', ventas: 3120000 },
];
