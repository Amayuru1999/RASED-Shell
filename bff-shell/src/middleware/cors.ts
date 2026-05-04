import cors from 'cors';

const allowedOrigins = [
  'http://localhost:9000',  // Shell app
  'http://localhost:4001',  // MFE User Management (dev)
  'http://localhost:4002',  // MFE License Management (dev)
  'http://localhost:4003',  // MFE Production Management (dev)
  'http://localhost:4004',  // MFE Reporting Management (dev)
];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: Origin ${origin} is not allowed`));
    }
  },
  credentials: true,  // Required for cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
