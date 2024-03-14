import { configDotenv } from "dotenv";
import ConnectDB from "./db/index.js";
import app from "./app.js";

configDotenv({
    path: './.env'
})

ConnectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000, ()=>{
        console.log(`Server is listening on port ${process.env.PORT}`)
    })
    app.on("error", (error)=>{
        console.log("ERROR occured during connection: ", error)
    })
})
.catch((error)=>{
    console.log("MongoDB connection failed.: ", error )
});