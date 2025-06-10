const express = require('express')
require('dotenv').config()
const cors = require('cors')
const app = express()
const port = process.env.PORT || 3000

// middleware
app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    const bookCollection = client.db('bookshelf').collection('books')
    // books related APIs
    app.get('/books', async (req, res) => {
      const result = await bookCollection.find().toArray()
      res.send(result)
    })
    app.get('/my-books/:email', async(req, res)=> {
      const email = req.params.email
      const filter = {user_email : email}
      const myBooks = await bookCollection.find(filter).toArray()
      res.send(myBooks)
    })
    app.get('/my-book/:id', async (req, res)=> {
      const {id} = req.params;
      const query = { _id : new ObjectId(id)}
      const result = await bookCollection.findOne(query)
      res.send(result)
    })
    app.post('/books', async (req,res)=> {
      const bookData = req.body;
      const result = await bookCollection.insertOne(bookData)
      res.send(result)
    })
    app.put('/update-book/:id', async (req, res)=> {
      const {id} = req.params;
      const filter =  { _id : new ObjectId(id)}
      const updatedBook = req.body
      const updatedDoc = {
        $set: updatedBook
      }
      const options = { upsert : true }
      const result = await bookCollection.updateOne(filter, updatedDoc, options)
      res.send(result)
    })
    app.patch('/book/:id/upvote', async (req, res)=> {
      const bookId = req.params.id;

      const result = await bookCollection.findOneAndUpdate(
        {_id: new ObjectId(bookId)},
        { $inc: {upvote : 1}},
        {returnDocument: 'after'} // to get updated doc
      )

      if(!result) {
        return res.status(404).json({message: 'Book not found'})
      }
      res.json({upvote : result.upvote})
    })
    app.delete('/books/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id : new ObjectId(id)}
      const result = await bookCollection.deleteOne(query)
      res.send(result)
    })
    // users related APIs
    app.get('/users', async (req, res)=> {
      const result = await usersCollection.find().toArray();
      res.send(result)
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
