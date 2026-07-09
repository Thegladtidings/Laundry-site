import express, {type Request, type Response} from 'express';
import connectDB from './config/database.js';
import dotenv from 'dotenv';
dotenv.config();
import loginRoutes from './routes/loginroutes.js';

const app = express();

app.use(express.json());
app.use(loginRoutes);


const PORT = process.env.PORT || 3000;


app.listen(PORT, () => {
    connectDB();
  console.log(`Server is running on port ${PORT} and connected to the database manager`);
});
