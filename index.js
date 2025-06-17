const express = require('express')
require('dotenv').config()
const cors = require('cors')

var admin = require("firebase-admin");
//firebase admin sdk
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString(
  'utf-8'
)
var serviceAccount = JSON.parse(decoded)
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

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

// jwt middlewares
const verifyJWT = async (req,res,next) => {
  const token = req?.headers?.authorization?.split(' ')[1]
   if (!token) return res.status(401).send({ message: 'Unauthorized Access!' })
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    req.tokenEmail = decoded.email
    next()
  } catch (err) {
    console.log(err)
    return res.status(401).send({ message: 'Unauthorized Access!' })
  }
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //await client.connect();

    const usersCollection = client.db('bookshelf').collection('users')
    const bookCollection = client.db('bookshelf').collection('books')
    const reviewsCollection = client.db('bookshelf').collection('reviews')

    // reviews related APIs
    app.post('/reviews', async (req, res) => {
      const { book_id, user_email, review_text } = req.body;

    if (!book_id || !user_email || !review_text) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const existing = await reviewsCollection.findOne({ book_id, user_email });

      if (existing) {
        return res.status(409).json({ error: "Review already exists. Use PUT to update." });
      }

      const result = await reviewsCollection.insertOne({
        book_id,
        user_email,
        review_text,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      res.send(result)
    })

    app.put("/reviews/:id", async (req,res)=> {
      const {id} = req.params;
      const {review_text} = req.body;
      const result = reviewsCollection.updateOne(
        {_id: new ObjectId(id)},
        { $set: {review_text, updatedAt: new Date}}
      )
      res.send(result)
    })

    app.get("/reviews", async( req,res)=> {
      const {book_id} = req.query;
      if (!book_id) {
      return res.status(400).json({ error: "Missing book_id in query" });
    }
    const result = await reviewsCollection
      .find({book_id})
      .sort({updatedAt: -1})
      .toArray()

    res.send(result)
    })

    app.delete("/reviews/:id", async (req,res)=> {
      const {id} = req.params
      const result = await reviewsCollection.deleteOne({_id : new ObjectId(id)})
      res.send(result)
    })
    
    // books related APIs
    app.get('/newlyReleased', async (req,res)=> {
      const result = await bookCollection.find().sort({createdAt: -1}).limit(5).toArray()
      res.send(result)
    })

    // get books by search and filter
    app.get('/books', async (req, res) => {
  const { search, status } = req.query;

  const query = {};

  if (search) {
    query.$or = [
      { book_title: { $regex: search, $options: 'i' } },
      { book_author: { $regex: search, $options: 'i' } }
    ];
  }

  if (status) {
    query.reading_status = status;
  }

  try {
    const books = await bookCollection.find(query).toArray();
    res.send(books);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: 'Failed to fetch books' });
  }
});

    // app.get('/books', async (req, res) => {
    //   const result = await bookCollection.find().toArray()
    //   res.send(result)
    // })
    app.get('/my-books/:email' , verifyJWT, async(req, res)=> {
      const decodedEmail = req.tokenEmail
      const email = req.params.email

      if(decodedEmail !== email)
        return res.status(403).send({ message: 'Forbidden Access!' })

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
    app.get('/popular-books', async (req, res)=> {
      const books = await bookCollection.find().sort({upvote: -1}).limit(6).toArray()
      res.json(books)
    })
    app.post('/books', async (req,res)=> {
      const bookData = req.body;
      const result = await bookCollection.insertOne(bookData)
      res.send(result)
    })
    app.put('/update-book/:id', verifyJWT, async (req, res)=> {
      const {id} = req.params;
      const tokenEmail = req.tokenEmail;

      const filter =  { _id : new ObjectId(id)}
      const book = await bookCollection.findOne(filter);

      if(!book) return res.status(404).send({message: 'Book not found'})
      if(book.user_email !== tokenEmail){
        return res.status(403).send({message: 'Forbidden Access'})
      }
      //const updatedBook = req.body
      const updatedDoc = {
        $set: req.body
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

    // PATCH: Update reading status
app.patch('/books/:id/reading-status', async (req, res) => {
  const bookId = req.params.id;
  const { reading_status } = req.body;

  const result = await bookCollection.updateOne(
    { _id: new ObjectId(bookId) },
    { $set: { reading_status } }
  );

  res.send(result);
});


    app.delete('/books/:id', verifyJWT, async (req, res) => {
      const id = req.params.id;
      const tokenEmail = req.tokenEmail;

      const query = {_id : new ObjectId(id)}
      const book = await bookCollection.findOne(query)

      if (!book) return res.status(404).send({message: 'Book not found'});
      if(book.user_email !== tokenEmail) {
        return res.status(403).send({ message: 'Forbidden: You can only delete your own books'})
      }

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
