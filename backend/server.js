// Server API
// we will need 2 servers running, one for backend and one for frontend

const PORT = 8080; 
const app = require('express')(); 
const cors = require('cors'); // security protocol that prevents applications from different ports to access your info. 


// Morgan is a middleware for logging HTTP requests within Express.js applications. 
const morgan = require('morgan');

app.use(morgan('dev')); 
app.use(cors());


// using fake data to test connection fronted / backend 
const data = [
  {
    id: 123, 
    title: "FAKE DATA TEST",
    instructions: "Bacon ipsum dolor amet buffalo boudin ham pig andouille chislic, doner venison salami pancetta meatball. "
  }
]


// the endpoint http://localhost/8080/fakedata should display the data object in a form of JSON
app.get('/fakedata', (req, res) => {
  res.json(data);
})

app.listen(PORT, () => console.log(`Server is listening on port ${PORT}`))
