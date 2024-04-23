const express =require('express');

const app=express();

const {mongoose} = require('./db/mongoose');

const bodyParser = require('body-parser');
//Load in the mongoose models
const {List,Task,User}=require('./db/models');

//Load middleware
app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({extended:false}));

// CORS HEADERS MIDDLEWARE
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods","GET, POST, HEAD, OPTIONS, PUT, PATCH, DELETE");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
/*Route Handlers*/
/*List Route*/

// Verify Refresh Token Middleware (which will be verifying the session)
let verifySession = (req, res, next) => {
  // grab the refresh token from the request header
  let refreshToken = req.header('x-refresh-token');

  // grab the _id from the request header
  let _id = req.header('_id');

  User.findByIdAndToken(_id, refreshToken).then((user) => {
      if (!user) {
          // user couldn't be found
          return Promise.reject({
              'error': 'User not found. Make sure that the refresh token and user id are correct'
          });
      }


      // if the code reaches here - the user was found
      // therefore the refresh token exists in the database - but we still have to check if it has expired or not

      req.user_id = user._id;
      req.userObject = user;
      req.refreshToken = refreshToken;

      let isSessionValid = false;

      user.sessions.forEach((session) => {
          if (session.token === refreshToken) {
              // check if the session has expired
              if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
                  // refresh token has not expired
                  isSessionValid = true;
              }
          }
      });

      if (isSessionValid) {
          // the session is VALID - call next() to continue with processing this web request
          next();
      } else {
          // the session is not valid
          return Promise.reject({
              'error': 'Refresh token has expired or the session is invalid'
          })
      }

  }).catch((e) => {
      res.status(401).send(e);
  })
}

/* END MIDDLEWARE  */

app.get('/lists',(req,res)=>{
    //We want to return an array of all the lists in the database
    List.find().then((lists)=>{
        res.send(lists);
    }).catch((e)=>{
        res.send(e);
    });
})
app.post('/lists', async (req, res) => {
    try {
      const title = req.body.title;
      const newList = new List({ title });
      console.log('Received title:', req.body.title);
      console.log('Created new list:', newList);

      const listDoc = await newList.save();
      res.send(listDoc);
    } catch (error) {
      console.error('Error saving list:', error);
      res.status(500).send({ message: 'Error creating list' });
    }
  });
app.patch('/lists/:id', async (req, res) => {
    try {
      // Extract ID and updates
      const id = new mongoose.Types.ObjectId(req.params.id);
      const updates = req.body;
      console.log('Request parameter ID:', id);
      console.log('Request body:', updates);
  
      // Update the list
      const updatedList = await List.findOneAndUpdate({ _id: id }, updates, { new: true });
  
      if (!updatedList) {
        return res.status(404).send({ message: 'List not found' });
      }
  
      res.send(updatedList);
    } catch (error) {
      console.error('Error updating list:', error);
      if (error.name === 'ValidationError') {
        return res.status(400).send({ message: 'Validation error', errors: error.errors }); // Handle validation errors specifically
      }
      res.status(500).send({ message: 'Error updating list' });
    }
  });
  

  app.delete('/lists/:id', async (req, res) => {
    try {
      const id = new mongoose.Types.ObjectId(req.params.id);
      const deletedList = await List.findOneAndDelete({ _id: id, _userId: req.user_id });
  
      if (!deletedList) {
        return res.status(404).send({ message: 'List not found' });
      }
  
      res.send({ message: 'List deleted successfully' }); // Or send the deletedList if needed
    } catch (error) {
      console.error('Error deleting list:', error);
      res.status(500).send({ message: 'Error deleting list' });
    }
  });

  app.get('/lists/:listId/tasks', async (req, res) => {
    // We want to return all tasks that belong to a specific list (specified by listId)
    await Task.find({
        _listId: req.params.listId
    }).then((tasks) => {
        res.send(tasks);
    })
});

app.post('/lists/:listId/tasks', async (req, res) => {
  try {
    const newTask = new Task({
      title: req.body.title,
      _listId: req.params.listId
    });

    const newTaskDoc = await newTask.save();

    res.send(newTaskDoc);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});


app.patch('/lists/:listId/tasks/:taskId', async (req, res) => {
  try {
    // Check if listId and taskId are provided
    if (!req.params.listId || !req.params.taskId) {
      return res.status(400).send({ message: 'List ID or Task ID is missing' });
    }

    const updatedTask = await Task.findOneAndUpdate({
      _id: req.params.taskId,
      _listId: req.params.listId
    }, {
      $set: req.body
    }).exec();

    if (!updatedTask) {
      return res.status(404).send({ message: 'Task not found' });
    }

    res.send({ message: 'Updated Successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

app.delete('/lists/:listId/tasks/:taskId', async (req, res) => {
  try {
    // Check if listId and taskId are provided
    if (!req.params.listId || !req.params.taskId) {
      return res.status(400).send({ message: 'List ID or Task ID is missing' });
    }

    const removedTaskDoc = await Task.findOneAndDelete({
      _id: req.params.taskId,
      _listId: req.params.listId
    }).exec();

    if (!removedTaskDoc) {
      return res.status(404).send({ message: 'Task not found' });
    }

    res.send(removedTaskDoc);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

app.post('/users', async (req, res) => {
  try {
    const body = req.body;

    // Validate input fields
    if (!body.email || !body.password) {
      return res.status(400).send({ error: 'Email and password are required.' });
    }

    // Check if a user with the same email already exists
    const existingUser = await User.findOne({ email: body.email });
    if (existingUser) {
      return res.status(400).send({ error: 'Email is already taken.' });
    }

    // Create a new user
    const newUser = new User(body);
    await newUser.save();

    // Create session and generate auth tokens
    const refreshToken = await newUser.createSession();
    const accessToken = await newUser.generateAccessAuthToken();

    // Send response with auth tokens in headers and user object in body
    res
      .header('x-refresh-token', refreshToken)
      .header('x-access-token', accessToken)
      .send({ user: newUser });
  } catch (error) {
    // Handle errors
    console.error('User sign-up failed:', error);
    res.status(400).send({ error: 'User sign-up failed. Please try again later.' });
  }
});


app.post('/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email and password inputs
    if (!email || !password) {
      return res.status(400).send({ error: 'Email and password are required.' });
    }

    const user = await User.findByCredentials(email, password);
    const refreshToken = await user.createSession();
    const accessToken = await user.generateAccessAuthToken();

    // Send response with auth tokens in headers and user object in body
    res
      .header('x-refresh-token', refreshToken)
      .header('x-access-token', accessToken)
      .send({ user });
  } catch (error) {
    // Handle errors
    console.error('Login failed:', error);
    res.status(400).send({ error: 'Invalid email or password.' });
  }
});


/**
 * GET /users/me/access-token
 * Purpose: generates and returns an access token
 */
app.get('/users/me/access-token', verifySession, async (req, res) => {
  try {
    // Generate a new access token for the authenticated user
    const accessToken = await req.userObject.generateAccessAuthToken();

    // Send the new access token in the response headers and body
    res.header('x-access-token', accessToken).send({ accessToken });
  } catch (error) {
    // Handle errors
    console.error('Error generating access token:', error);
    res.status(500).send({ error: 'Failed to generate access token.' });
  }
}); 




app.listen(3000,()=>{
    console.log("Server is listening on port 3000");
})