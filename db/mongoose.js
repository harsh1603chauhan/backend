// this file will handle connection logic to the MongoDB database 

const mongoose = require('mongoose');

mongoose.Promise = global.Promise;

mongoose.connect('mongodb+srv://harshchauhan16032004:VujXmvbYHMS6CSMu@cluster0.avqmqac.mongodb.net/TaskManager?retryWrites=true&w=majority', {
})
    .then(() => {
        console.log('Connected to MongoDB database!');
    })
    .catch(err => {
        console.error('Error connecting to MongoDB:', err);
    });

module.exports = {
    mongoose
};
