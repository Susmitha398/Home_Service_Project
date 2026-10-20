require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
app.use('/api/payments/razorpay/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
app.use(express.json({ limit: '32kb' }));

const defaultServices = [
  { id: 'cleaning', name: 'Home cleaning', category: 'Cleaning', description: 'Choose the level of clean that suits your home.', price: 89, duration: '2–3 hours', icon: '✳', color: 'mint', rating: '4.9', tasks: [{ name: 'Basic home cleaning · Low level', price: 89 }, { name: 'Deep home cleaning · High level', price: 149 }, { name: 'Bathroom cleaning', price: 45 }, { name: 'Kitchen cleaning', price: 55 }, { name: 'Sofa cleaning', price: 60 }] },
  { id: 'plumbing', name: 'Plumbing service', category: 'Repairs', description: 'Leaks, fittings & everything in between.', price: 65, duration: '1–2 hours', icon: '⌁', color: 'blue', rating: '4.8', tasks: [{ name: 'Tap leakage repair', price: 65 }, { name: 'Pipe leakage repair', price: 95 }, { name: 'Washbasin installation', price: 110 }, { name: 'Bathroom plumbing', price: 120 }] },
  { id: 'electrical', name: 'Electrical service', category: 'Repairs', description: 'Safe fixes from certified pros.', price: 75, duration: '1–2 hours', icon: 'ϟ', color: 'yellow', rating: '4.9', tasks: [{ name: 'Fan installation', price: 75 }, { name: 'Light repair', price: 55 }, { name: 'Switchboard repair', price: 89 }, { name: 'Wiring service', price: 125 }] },
  { id: 'gardening', name: 'Garden care', category: 'Outdoor', description: 'Keep your little patch thriving.', price: 55, duration: '1 hour', icon: '❋', color: 'peach', rating: '4.7', tasks: [{ name: 'Garden maintenance', price: 55 }, { name: 'Hedge trimming', price: 65 }] },
  { id: 'appliance', name: 'Appliance repair', category: 'Repairs', description: 'Get your everyday essentials running.', price: 79, duration: '1–2 hours', icon: '◉', color: 'lilac', rating: '4.8', tasks: [{ name: 'Washing machine repair', price: 79 }, { name: 'Refrigerator repair', price: 89 }] },
  { id: 'painting', name: 'Painting', category: 'Home projects', description: 'A fresh coat, a fresh feeling.', price: 120, duration: 'Half day', icon: '▱', color: 'rose', rating: '4.9', tasks: [{ name: 'Room painting', price: 120 }, { name: 'Touch-up painting', price: 65 }] },
  { id: 'ac', name: 'AC service', category: 'Repairs', description: 'Keep your home cool and comfortable.', price: 99, duration: '1–2 hours', icon: '❄', color: 'blue', rating: '4.8', tasks: [{ name: 'AC general service', price: 99 }, { name: 'Filter cleaning', price: 45 }, { name: 'AC repair', price: 125 }, { name: 'AC installation', price: 180 }] },
];
const dataFile = path.resolve(process.env.DATA_FILE || path.join(__dirname, 'data', 'nest-data.json'));
function readStore() {
  try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') console.error('Could not read data store:', error.message); return {}; }
}
const stored = readStore();
const users = new Map((stored.users || []).map(user => [user.email, user]));
const sessions = new Map(stored.sessions || []);
const bookings = stored.bookings || [];
const services = stored.services?.length ? stored.services : defaultServices;
const cleaningService = services.find(service => service.id === 'cleaning');
const defaultCleaning = defaultServices.find(service => service.id === 'cleaning');
if (cleaningService && (!cleaningService.tasks?.length || cleaningService.tasks.some(task => task.name === 'Full house cleaning'))) {
  Object.assign(cleaningService, { description: defaultCleaning.description, price: defaultCleaning.price, tasks: defaultCleaning.tasks });
}
const technicians = stored.technicians?.length ? stored.technicians : [
  { id: 'tech-maya', name: 'Maya Chen', email: 'maya@nest.home', phone: '555-0101', specialty: 'Cleaning', available: true },
  { id: 'tech-noah', name: 'Noah Williams', email: 'noah@nest.home', phone: '555-0102', specialty: 'Outdoor', available: true },
  { id: 'tech-eli', name: 'Eli Thompson', email: 'eli@nest.home', phone: '555-0103', specialty: 'Repairs', available: true },
  { id: 'tech-ava', name: 'Ava Patel', email: 'ava@nest.home', phone: '555-0104', specialty: 'Home projects', available: true },
];
function saveStore() {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const temp = `${dataFile}.tmp`;
  fs.writeFileSync(temp, JSON.stringify({ users: [...users.values()], sessions: [...sessions.entries()], bookings, services, technicians }, null, 2), { mode: 0o600 });
  fs.renameSync(temp, dataFile);
}
const demoHash = crypto.scryptSync(process.env.DEMO_ADMIN_PASSWORD || 'admin123', 'nest-demo-salt', 64).toString('hex');
if (!users.has('admin@nest.home')) users.set('admin@nest.home', { id: 'user-admin', name: 'Nest Admin', email: 'admin@nest.home', role: 'admin', passwordHash: demoHash, salt: 'nest-demo-salt' });
for (const tech of technicians) {
  if (!users.has(tech.email)) { const salt = `nest-${tech.id}`; users.set(tech.email, { id: `user-${tech.id}`, name: tech.name, email: tech.email, phone: tech.phone, role: 'technician', technicianId: tech.id, salt, passwordHash: crypto.scryptSync(process.env.DEMO_TECH_PASSWORD || 'tech123', salt, 64).toString('hex') }); }
  tech.userId = users.get(tech.email).id;
}
saveStore();

function publicUser(user) { return { id: user.id, name: user.name, email: user.email, phone: user.phone || '', role: user.role, technicianId: user.technicianId || null }; }
function makePassword(password) { const salt = crypto.randomBytes(16).toString('hex'); return { salt, passwordHash: crypto.scryptSync(password, salt, 64).toString('hex') }; }
function passwordMatches(password, user) { const expected = crypto.scryptSync(password, user.salt, 64); const actual = Buffer.from(user.passwordHash, 'hex'); return expected.length === actual.length && crypto.timingSafeEqual(expected, actual); }
function auth(required = true) {
  return (req, res, next) => {
    const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const userId = sessions.get(token);
    const user = [...users.values()].find(item => item.id === userId);
    if (!user) return required ? res.status(401).json({ message: 'Please sign in to continue.' }) : next();
    req.user = user;
    next();
  };
}
function admin(req, res, next) { if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' }); next(); }
function validText(value, max = 300) { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max; }

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'Nest Home Services API' }));
app.get('/api/services', (_req, res) => res.json(services.filter(service => service.active !== false)));
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, phone } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!validText(name, 80) || !validText(phone, 30) || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || typeof password !== 'string' || password.length < 6 || password.length > 128) return res.status(400).json({ message: 'Enter your name, phone, valid email and password of at least 6 characters.' });
  if (users.has(normalizedEmail)) return res.status(409).json({ message: 'An account with that email already exists.' });
  const credentials = makePassword(password);
  const user = { id: crypto.randomUUID(), name: name.trim(), email: normalizedEmail, phone: phone.trim(), role: 'customer', ...credentials };
  users.set(normalizedEmail, user);
  const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, user.id);
  saveStore();
  res.status(201).json({ token, user: publicUser(user) });
});
app.post('/api/auth/login', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const user = users.get(email);
  if (!user || !passwordMatches(String(req.body?.password || ''), user)) return res.status(401).json({ message: 'Email or password is incorrect.' });
  const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, user.id);
  saveStore();
  res.json({ token, user: publicUser(user) });
});
app.post('/api/auth/logout', auth(), (req, res) => { const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, ''); sessions.delete(token); saveStore(); res.json({ ok: true }); });

app.get('/api/bookings', auth(), (req, res) => {
  const rows = req.user.role === 'admin' ? bookings : req.user.role === 'technician' ? bookings.filter(item => item.technicianId === req.user.technicianId) : bookings.filter(item => item.userId === req.user.id);
  res.json(rows.map(({ userId, ...item }) => item).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});
app.post('/api/bookings', auth(), (req, res) => {
  const { serviceId, taskName, date, time, address, notes = '', paymentMethod = 'later' } = req.body || {};
  const service = services.find(item => item.id === serviceId);
  const task = service?.tasks?.find(item => item.name === taskName) || (taskName ? null : { name: service?.name, price: service?.price });
  if (req.user.role !== 'customer') return res.status(403).json({ message: 'Only customer accounts can create bookings.' });
  if (!service || !service.active && service.active !== undefined || !task || !validText(date, 30) || !validText(time, 30) || !validText(address, 240) || (typeof notes !== 'string' || notes.length > 1000) || !['online', 'later'].includes(paymentMethod)) return res.status(400).json({ message: 'Choose a service and task, date, time and valid address.' });
  const booking = { id: `HS-${crypto.randomInt(1000, 9999)}`, userId: req.user.id, customer: req.user.name, customerPhone: req.user.phone, serviceId, service: service.name, task: task.name, date: `${date}, ${time}`, time, address: address.trim(), notes: notes.trim(), status: 'Requested', technician: 'Unassigned', technicianId: null, amount: task.price, paymentMethod, paymentStatus: paymentMethod === 'online' ? 'Payment pending' : 'Pay after service', review: null, createdAt: new Date().toISOString() };
  bookings.push(booking);
  saveStore();
  const { userId, ...response } = booking;
  res.status(201).json(response);
});
app.patch('/api/bookings/:id', auth(), (req, res) => {
  const booking = bookings.find(item => item.id === req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });
  const isAssignedTech = req.user.role === 'technician' && booking.technicianId === req.user.technicianId;
  if (req.user.role !== 'admin' && booking.userId !== req.user.id && !isAssignedTech) return res.status(403).json({ message: 'You cannot update this booking.' });
  const { status, technicianId, paymentStatus } = req.body || {};
  if (status !== undefined) {
    if (isAssignedTech) {
      const nextSteps = { Confirmed: ['Accepted', 'Rejected'], Accepted: ['On The Way'], 'On The Way': ['Work Started'], 'Work Started': ['Completed'] };
      if (!nextSteps[booking.status]?.includes(status)) return res.status(400).json({ message: `You cannot move this booking from ${booking.status} to ${status}.` });
    } else if (req.user.role === 'customer' && status === 'Cancelled') {
      if (booking.paymentStatus !== 'Pay after service') return res.status(409).json({ message: 'Only unpaid bookings can be cancelled here. Contact support about online or completed payments.' });
      if (!['Requested', 'Confirmed', 'Accepted', 'Rejected'].includes(booking.status)) return res.status(400).json({ message: 'This booking can no longer be cancelled online. Please contact support.' });
    } else if (req.user.role !== 'admin' || !['Requested', 'Confirmed', 'Accepted', 'Rejected', 'On The Way', 'Work Started', 'Completed', 'Cancelled'].includes(status)) return res.status(400).json({ message: 'Invalid status update.' });
    booking.status = status;
  }
  if (technicianId !== undefined) {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required to assign technicians.' });
    const tech = technicians.find(item => item.id === technicianId);
    if (!tech || !tech.available) return res.status(400).json({ message: 'Choose an available technician.' });
    booking.technicianId = tech.id; booking.technician = tech.name;
    if (['Requested', 'Rejected'].includes(booking.status)) booking.status = 'Confirmed';
  }
  if (paymentStatus !== undefined) {
    if (req.user.role !== 'admin' || !['Paid', 'Pay after service', 'Payment pending', 'Refunded'].includes(paymentStatus)) return res.status(403).json({ message: 'Admin access required to update payment.' });
    booking.paymentStatus = paymentStatus;
  }
  saveStore();
  const { userId, ...response } = booking;
  res.json(response);
});
app.post('/api/bookings/:id/review', auth(), (req, res) => {
  const booking = bookings.find(item => item.id === req.params.id && item.userId === req.user.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });
  if (req.user.role !== 'customer') return res.status(403).json({ message: 'Only customers can leave reviews.' });
  const { rating, comment = '' } = req.body || {};
  if (booking.status !== 'Completed') return res.status(400).json({ message: 'You can review after the service is completed.' });
  if (booking.review) return res.status(409).json({ message: 'A review has already been submitted for this booking.' });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || typeof comment !== 'string' || comment.length > 1000) return res.status(400).json({ message: 'Choose a rating from 1 to 5 and keep comments under 1000 characters.' });
  booking.review = { rating, comment: comment.trim(), customer: req.user.name, createdAt: new Date().toISOString() };
  saveStore();
  res.status(201).json({ id: booking.id, review: booking.review });
});
app.post('/api/payments/razorpay/order', auth(), async (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return res.status(503).json({ message: 'Online UPI payments are not configured. Add Razorpay API keys to backend/.env.' });
  const booking = bookings.find(item => item.id === req.body?.bookingId && item.userId === req.user.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });
  if (booking.paymentStatus === 'Paid') return res.status(409).json({ message: 'This booking is already paid.' });
  const amountPaise = Math.round(Number(booking.amount) * 100);
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) return res.status(400).json({ message: 'Online payment must be at least ₹1.' });
  try {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt: booking.id, notes: { booking_id: booking.id, customer_id: req.user.id } }),
    });
    const order = await response.json();
    if (!response.ok) return res.status(502).json({ message: order.error?.description || 'Could not create a Razorpay order.' });
    booking.razorpayOrderId = order.id;
    booking.paymentStatus = 'Payment pending';
    saveStore();
    res.json({ keyId, orderId: order.id, amount: order.amount, currency: order.currency, name: 'Nest Home Services', description: `${booking.task || booking.service} · ${booking.id}`, prefill: { name: req.user.name, email: req.user.email, contact: req.user.phone || '' } });
  } catch (error) { console.error('Razorpay order creation failed:', error.message); res.status(502).json({ message: 'Could not connect to Razorpay.' }); }
});
app.post('/api/payments/razorpay/verify', auth(), async (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
  if (!keyId || !keySecret) return res.status(503).json({ message: 'Razorpay payments are not configured.' });
  const booking = bookings.find(item => item.razorpayOrderId === orderId && item.userId === req.user.id);
  if (!booking || typeof paymentId !== 'string' || typeof signature !== 'string') return res.status(400).json({ message: 'Payment details could not be verified.' });
  const expected = crypto.createHmac('sha256', keySecret).update(`${booking.razorpayOrderId}|${paymentId}`).digest();
  let received;
  try { received = Buffer.from(signature, 'hex'); } catch { received = Buffer.alloc(0); }
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return res.status(400).json({ message: 'Payment signature is invalid.' });
  try {
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` } });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok || payment.order_id !== booking.razorpayOrderId || payment.amount !== Math.round(booking.amount * 100) || payment.currency !== 'INR') return res.status(400).json({ message: 'Payment amount or order does not match this booking.' });
    let finalPayment = payment;
    if (payment.status === 'authorized') {
      const captureResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/capture`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: payment.amount, currency: 'INR' }) });
      finalPayment = await captureResponse.json();
      if (!captureResponse.ok) return res.status(502).json({ message: finalPayment.error?.description || 'Payment authorized but capture is still pending.' });
    }
    if (finalPayment.status === 'captured') { booking.paymentStatus = 'Paid'; booking.razorpayPaymentId = paymentId; saveStore(); }
    res.json({ bookingId: booking.id, paymentStatus: booking.paymentStatus });
  } catch (error) { console.error('Razorpay payment verification failed:', error.message); res.status(502).json({ message: 'Could not verify the payment with Razorpay yet.' }); }
});
app.post('/api/payments/razorpay/webhook', (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(503).send('Razorpay webhook is not configured.');
  const signature = req.get('x-razorpay-signature') || '';
  const expected = crypto.createHmac('sha256', webhookSecret).update(req.body).digest();
  let received;
  try { received = Buffer.from(signature, 'hex'); } catch { received = Buffer.alloc(0); }
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return res.status(400).send('Invalid webhook signature.');
  let event;
  try { event = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).send('Invalid webhook body.'); }
  if (event.event === 'payment.captured') {
    const orderId = event.payload?.payment?.entity?.order_id;
    const booking = bookings.find(item => item.razorpayOrderId === orderId);
    if (booking) { booking.paymentStatus = 'Paid'; booking.razorpayPaymentId = event.payload.payment.entity.id; saveStore(); }
  }
  res.json({ received: true });
});
app.post('/api/payments/checkout', auth(), async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ message: 'Online card payments are not configured. You can pay after your service.' });
  const booking = bookings.find(item => item.id === req.body?.bookingId && (item.userId === req.user.id || req.user.role === 'admin'));
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });
  if (booking.paymentStatus === 'Paid') return res.status(409).json({ message: 'This booking is already paid.' });
  try {
    const origin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
    const form = new URLSearchParams({ mode: 'payment', success_url: `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/?payment=cancelled`, customer_email: req.user.email, 'line_items[0][price_data][currency]': process.env.PAYMENT_CURRENCY || 'usd', 'line_items[0][price_data][unit_amount]': String(Math.round(booking.amount * 100)), 'line_items[0][price_data][product_data][name]': `${booking.service} · Nest Home Services`, 'line_items[0][quantity]': '1', 'metadata[booking_id]': booking.id, 'metadata[user_id]': req.user.id });
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
    const session = await stripeResponse.json();
    if (!stripeResponse.ok) return res.status(502).json({ message: session.error?.message || 'Could not start secure checkout.' });
    booking.stripeSessionId = session.id; saveStore();
    res.json({ url: session.url });
  } catch (error) { console.error('Stripe checkout failed:', error.message); res.status(502).json({ message: 'Could not connect to secure checkout.' }); }
});
app.get('/api/payments/confirm', auth(), async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ message: 'Online card payments are not configured.' });
  const sessionId = req.query.session_id;
  if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) return res.status(400).json({ message: 'Invalid checkout session.' });
  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } });
    const session = await response.json();
    if (!response.ok || session.metadata?.user_id !== req.user.id) return res.status(404).json({ message: 'Checkout session not found.' });
    const booking = bookings.find(item => item.id === session.metadata.booking_id && item.userId === req.user.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    if (session.payment_status === 'paid') { booking.paymentStatus = 'Paid'; saveStore(); }
    res.json({ paymentStatus: booking.paymentStatus, bookingId: booking.id });
  } catch (error) { console.error('Stripe confirmation failed:', error.message); res.status(502).json({ message: 'Could not confirm payment.' }); }
});
app.post('/api/payments/webhook', (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).send('Payment webhook is not configured.');
  const signature = req.get('stripe-signature') || '';
  const parts = Object.fromEntries(signature.split(',').map(part => part.split('=')));
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300 || !parts.v1) return res.status(400).send('Invalid signature.');
  const expected = crypto.createHmac('sha256', secret).update(`${parts.t}.${req.body.toString('utf8')}`).digest();
  let valid = false;
  try { valid = crypto.timingSafeEqual(expected, Buffer.from(parts.v1, 'hex')); } catch { valid = false; }
  if (!valid) return res.status(400).send('Invalid signature.');
  const event = JSON.parse(req.body.toString('utf8'));
  if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
    const session = event.data.object;
    const booking = bookings.find(item => item.id === session.metadata?.booking_id && item.userId === session.metadata?.user_id);
    if (booking) { booking.paymentStatus = 'Paid'; saveStore(); }
  }
  res.json({ received: true });
});
app.get('/api/admin/summary', auth(), admin, (_req, res) => {
  res.json({ bookings: bookings.length, requests: bookings.filter(item => ['Requested', 'Rejected'].includes(item.status)).length, active: bookings.filter(item => ['Confirmed', 'Accepted', 'On The Way', 'Work Started'].includes(item.status)).length, revenue: bookings.filter(item => item.paymentStatus === 'Paid').reduce((total, item) => total + item.amount, 0), customers: [...users.values()].filter(item => item.role === 'customer').length, technicians: technicians.length, services: services.filter(item => item.active !== false).length });
});
app.get('/api/admin/bookings', auth(), admin, (_req, res) => res.json(bookings.map(({ userId, ...item }) => ({ ...item, userId }))));
app.get('/api/admin/technicians', auth(), admin, (_req, res) => res.json(technicians));
app.post('/api/admin/technicians', auth(), admin, (req, res) => {
  const { name, email, phone, specialty, password } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!validText(name, 80) || !validText(phone, 30) || !validText(specialty, 80) || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || typeof password !== 'string' || password.length < 6 || password.length > 128) return res.status(400).json({ message: 'Provide a name, phone, specialty, valid email and password of at least 6 characters.' });
  if (users.has(normalizedEmail)) return res.status(409).json({ message: 'An account already uses that email.' });
  const tech = { id: `tech-${crypto.randomUUID()}`, name: name.trim(), email: normalizedEmail, phone: phone.trim(), specialty: specialty.trim(), available: true };
  const salt = crypto.randomBytes(16).toString('hex');
  const user = { id: crypto.randomUUID(), name: tech.name, email: normalizedEmail, phone: tech.phone, role: 'technician', technicianId: tech.id, salt, passwordHash: crypto.scryptSync(password, salt, 64).toString('hex') };
  tech.userId = user.id; technicians.push(tech); users.set(user.email, user); saveStore();
  res.status(201).json(tech);
});
app.get('/api/admin/services', auth(), admin, (_req, res) => res.json(services));
app.post('/api/admin/services', auth(), admin, (req, res) => {
  const { name, category, description, price, duration, tasks = [] } = req.body || {};
  if (!validText(name, 80) || !validText(category, 50) || !validText(description, 240) || !Number.isFinite(Number(price)) || Number(price) <= 0 || !validText(duration, 50) || !Array.isArray(tasks) || tasks.some(task => !validText(task.name, 80) || !Number.isFinite(Number(task.price)) || Number(task.price) <= 0)) return res.status(400).json({ message: 'Enter valid service details and task prices.' });
  const id = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
  const service = { id, name: name.trim(), category: category.trim(), description: description.trim(), price: Number(price), duration: duration.trim(), icon: req.body.icon || '✳', color: req.body.color || 'mint', rating: 'New', tasks: tasks.map(task => ({ name: task.name.trim(), price: Number(task.price) })), active: true };
  services.push(service); saveStore(); res.status(201).json(service);
});
app.patch('/api/admin/services/:id', auth(), admin, (req, res) => {
  const service = services.find(item => item.id === req.params.id);
  if (!service) return res.status(404).json({ message: 'Service not found.' });
  const allowed = ['name', 'category', 'description', 'duration', 'icon', 'color'];
  for (const key of allowed) if (req.body[key] !== undefined && validText(req.body[key], 240)) service[key] = req.body[key].trim();
  if (req.body.price !== undefined && Number.isFinite(Number(req.body.price)) && Number(req.body.price) > 0) service.price = Number(req.body.price);
  if (req.body.tasks !== undefined && Array.isArray(req.body.tasks) && req.body.tasks.every(task => validText(task.name, 80) && Number.isFinite(Number(task.price)) && Number(task.price) > 0)) service.tasks = req.body.tasks.map(task => ({ name: task.name.trim(), price: Number(task.price) }));
  saveStore(); res.json(service);
});
app.delete('/api/admin/services/:id', auth(), admin, (req, res) => {
  const index = services.findIndex(item => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ message: 'Service not found.' });
  if (bookings.some(item => item.serviceId === req.params.id)) services[index].active = false;
  else services.splice(index, 1);
  saveStore(); res.json({ ok: true });
});
app.get('/api/admin/users', auth(), admin, (_req, res) => res.json([...users.values()].map(publicUser)));
app.get('/api/admin/reports', auth(), admin, (_req, res) => res.json({ bookings: bookings.length, grossPaid: bookings.filter(item => item.paymentStatus === 'Paid').reduce((sum, item) => sum + item.amount, 0), outstanding: bookings.filter(item => item.paymentStatus !== 'Paid' && item.paymentStatus !== 'Refunded').reduce((sum, item) => sum + item.amount, 0), byStatus: Object.fromEntries([...new Set(bookings.map(item => item.status))].map(status => [status, bookings.filter(item => item.status === status).length])), reviews: bookings.filter(item => item.review).map(item => ({ bookingId: item.id, service: item.service, task: item.task, ...item.review })) }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ message: 'Something went wrong.' }); });

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`Nest API listening on http://localhost:${port}`));
