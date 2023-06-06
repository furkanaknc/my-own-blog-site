require('dotenv').config()
const express = require(`express`);
const session = require('express-session');
const bodyParser = require(`body-parser`);
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const mongoose = require('mongoose');
const multer  = require('multer')
const bcrypt = require("bcrypt")
const saltRounds =10;




const app = express();

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(__dirname+"/public"));
app.set(`view engine`,`ejs`);
app.set("trust proxy", 1);
app.use(session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    
  }));


const url = process.env.MONGODB_URL;
mongoose.connect(url,{useNewUrlParser: true})
.then(()=> console.log("Connected to mongoDb!"));

const Schema = mongoose.Schema;

const CommentSchema = new Schema({
    Author: String,
    Comment: String,
    Time: String
})

const Comment = mongoose.model("Comment",CommentSchema);

const PostSchema = new Schema({
    ImageUrl: String,
    Title: String,
    Post: String,
    Time: String,
    Author: String,
    Comment: [CommentSchema],
    shareToModels: { type: Boolean, default: false },
  });
const Post = mongoose.model(`Post`,PostSchema);

const UserSchema = new Schema({
    userMail: { type: String, unique: true }, 
    userId: { type: String, unique: true },
    userPassword: String,
    role: { type: String, default: 'user' } // 'user' or 'admin'
  });
  
const User = mongoose.model(`User`,UserSchema)
//

//connect to cloudinary 
cloudinary.config({
    secure: true
  });
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: (req, file) => 'blog-website',
    }
});
//

//multer 
const parser = multer({ 
    storage: storage,
    limits:{
        fileSize:5e+7
    }
});
//


app.get("/",(req,res)=>{
    Post.find()
    .then(function(posts){
        res.render("home",{title:"Home",post:posts});
    })
    
})

app.get('/compose', (req, res) => {
    if (req.session.loggedIn && req.session.role === 'admin') {
      res.render('compose', { title: 'Compose', message: 'You can upload photos' });
    } else {
      res.redirect('/alert2');
    }
  });
  

  app.post('/compose', parser.single('avatar'), (req, res, next) => {
    const image = req.file ? req.file.path : '';
    const title = req.body.textTitle;
    const post = req.body.textPost;
    const shareToModels = req.body.shareToModels === 'true';
  
    // Image control
    if (req.file && !/^image/.test(req.file.mimetype)) {
      return res.render('compose', { title: 'Compose', message: 'File type is not an image!' });
    }
  
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const formattedDate = `${day}/${month}/${year}`;
  
    const userName = req.session.userName;
  
    // Save to MongoDB
    const blogPost = new Post({
      ImageUrl: image,
      Title: title,
      Post: post,
      Time: formattedDate,
      Author: userName,
      Comment: [],
      shareToModels: shareToModels,
    });
  
    blogPost
      .save()
      .then(() => {
        res.redirect('/');
      })
      .catch((err) => {
        res.send(err);
      });
  });
  
  

app.get("/about", function(req, res){
    res.render("about");
  });
  
  app.get("/contact", function(req, res){
    res.render("contact");
  });

app.get("/posts/:postID",(req,res)=>{
    const postID = req.params.postID;    

    Post.findById({_id:postID})
    .then(function(post){
        res.render("post",{message:"",postID:postID,title:post.Title,textTitle:post.Title,textPost:post.Post,image:post.ImageUrl,time:post.Time,author:post.Author,comments:post.Comment});
    })
})

app.get('/models', (req, res) => {
    Post.find({ shareToModels: true })
      .then((posts) => {
        res.render('models', { title: 'Models', posts: posts });
      })
      .catch((err) => {
        res.send(err);
      });
  });
  
  app.post("/models", (req, res) => {
    const postID = req.body.postID;
    const comment = req.body.comment;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const formattedDate = `${day}/${month}/${year}`;
  
    Post.findById(postID)
      .then((post) => {
        const newComment = {
          Author: req.session.userName,
          Comment: comment,
          Time: formattedDate,
        };
        post.Comment.push(newComment);
        return post.save();
      })
      .then(() => {
        res.redirect("/models");
      })
      .catch((err) => {
        res.send(err);
      });
  });
  
  

app.post("/posts/:postID",(req,res)=>{
    const postID = req.params.postID;    
    const comment = req.body.comment;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const formattedDate = `${day}/${month}/${year}`;
    //Comment
    if(!req.session.loggedIn){
        Post.findById({_id:postID})
        .then(function(post){
            res.render("post",{message:"You must be logged in to comment!",postID:postID,title:post.Title,textTitle:post.Title,textPost:post.Post,image:post.ImageUrl,time:post.Time,author:post.Author,comments:post.Comment});
        })
    }else{
        const userName = req.session.userName;
        const comments = new Comment({
            Author:userName,
            Comment:comment,
            Time:formattedDate
        })
        comments.save()
        .then(() => {
            Post.findById({_id:postID})
            .then((post)=> {
                post.Comment.push(comments)
                return post.save();
            })
            .then(() => {
                res.redirect("/posts/"+postID);
              })
              .catch((err) => {
                res.send(err);
              });
        })
        .catch((err)=>{
            res.send(err);
        })
    }
    
})
    

app.get("/signup",(req,res) => {
    if(!req.session.loggedIn){
        res.render("signup",{title:"Sing-in",message:"Welcome!"})
    }else{
        res.redirect("/alert")
    }
})

app.post("/signup", (req, res) => {

    const userMail = req.body.userMail;
    const nickName = req.body.nickName;
    const password = req.body.password;
    const password2 = req.body.password2;

    // Password encrypt
    if (password.length < 8) {
        res.render("signup", { title: "Sign-in", message: "Password length must be greater than 7!" })
    } else if (nickName.length < 4) {
        res.render("signup", { title: "Sign-in", message: "Username length must be greater than 3!" })
    } else {
        if (password === password2) {
            bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
                const user = new User({
                    userMail: userMail,
                    userId: nickName,
                    userPassword: hash
                })
                user.save()
                    .then(() => {
                        res.render("signup", { title: "Sign-in", message: "You have successfully registered" })
                    })
                    .catch((err) => {
                        res.render("signup", { title: "Sign-in", message: "Username or email already exists!" })
                    })
            })
        } else {
            res.render("signup", { title: "Sign-in", message: "Passwords don't match!" })
        }
    }

})

app.get('/login', (req, res) => {
    if (!req.session.loggedIn) {
      res.render('login', { title: 'Log-in', message: 'Welcome!' });
    } else {
      res.redirect('/alert');
    }
  });
  
  app.post('/login', (req, res) => {
    const userMail = req.body.userMail;
    const password = req.body.password;
  
    User.findOne({ userMail: userMail })
      .then((user) => {
        bcrypt.compare(password, user.userPassword, (err, result) => {
          if (result === true) {
            req.session.userMail = userMail;
            req.session.loggedIn = true;
            req.session.userName = user.userId;
            req.session.role = user.role; // Set the user's role in the session
            res.redirect('/');
          } else {
            res.render('login', { title: 'Log-in', message: 'Wrong password' });
          }
        });
      })
      .catch((err) => {
        res.render('login', { title: 'Log-in', message: 'Email is not registered' });
      });
  });
  
  
app.get("/alert",(req,res)=>{
    res.render("alert",{title:"ALERT"});
})

app.post("/alert",(req,res)=>{
    req.session.loggedIn = false;
    res.redirect("/signup")
})

app.get("/alert2",(req,res)=>{
    res.render("alert2",{title:"ALERT"});
})

app.post("/alert2",(req,res)=>{
    res.redirect("/login")
})








app.listen(process.env.PORT || 3000, function () {
  console.log("Server is running on port " + (process.env.PORT || 3000));
});
