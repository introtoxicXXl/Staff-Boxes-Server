require('dotenv').config();
const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 5000;

app = express();

app.use(cors())
app.use(express.json())


app.get('/',(req,res)=>{
    res.send('Stuff Boxes is on the way with your Parcel')
})
app.listen(port,()=>{
    console.log('stuff boxes right now on',port)
})