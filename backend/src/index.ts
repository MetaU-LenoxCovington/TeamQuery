import dotenv from 'dotenv';
import { app } from './app';

dotenv.config();

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
  console.log(` Health check available at http://localhost:${PORT}/health`);
  console.log(` Auth endpoints available at http://localhost:${PORT}/api/auth`);
});
