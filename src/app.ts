import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';
import { activityLogger } from './middleware/activityLogger';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import organizationRoutes from './routes/organization.routes';
import tierRoutes from './routes/tier.routes';
import productRoutes from './routes/product.routes';
import dealRoutes from './routes/deal.routes';
import quoteRoutes from './routes/quote.routes';
import leadRoutes from './routes/lead.routes';
import mdfRoutes from './routes/mdf.routes';
import dashboardRoutes from './routes/dashboard.routes';
import analyticsRoutes from './routes/analytics.routes';
import courseRoutes, { certificationRouter } from './routes/course.routes';
import documentRoutes from './routes/document.routes';
import notificationRoutes from './routes/notification.routes';
import activityRoutes from './routes/activity.routes';

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }),
);

// Request logging
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// General rate limiter
app.use(generalLimiter);

// Activity logger
app.use(activityLogger);

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/tiers', tierRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/deals', dealRoutes);
app.use('/api/v1/quotes', quoteRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/mdf', mdfRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/certifications', certificationRouter);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/activity', activityRoutes);

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// 404 handler for unmatched routes
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    meta: null,
    errors: [{ code: 'NOT_FOUND', message: 'Route not found', field: null }],
  });
});

// Global error handler
app.use(errorHandler);

export default app;
