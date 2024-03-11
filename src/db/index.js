import mongoose from "mongoose";
import { DATABASE_NAME } from "../constants.js";



const ConnectDB = async () =>{
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DATABASE_NAME}`);
        console.log(`\n MongoDB connected. DB HOST: ${connectionInstance.connection.host}`)
        
    } catch (error) {
        console.log("MongoDB Connection Error : ", error);
        process.exit(1)
        
    }
    
}

export default ConnectDB;