const express = require('express')
require('dotenv').config()
const cors = require('cors')
const app = express()
const port = process.env.PORT || 3000

// middleware
app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGO_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //await client.connect();

    const usersCollection = client.db('bookshelf').collection('users')
    // users related APIs
    app.get('/users', async (req, res)=> {
      const result = await usersCollection.find().toArray();
      res.send()
    })
    app.post('/users', async (req,res) => {
      const userProfile = req.body;
      const result = await usersCollection.insertOne(userProfile)
      res.send(result)
    })
    // Send a ping to confirm a successful connection
    //await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Welcome to Virtual BookShelf Server!')
})

app.listen(port, () => {
  console.log(`Sever running on port ${port}`)
})
