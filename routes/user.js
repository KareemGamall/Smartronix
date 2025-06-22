const express = require("express");
const router = express.Router();
const { signup, login, updateProfile } = require("../controllers/user");
const { isAuthenticated } = require("../middleware/auth");

// Auth routes
router.post("/signup", signup);
router.post("/login", login);
router.get("/logout", (req,res) => {
  res.clearCookie("token");
  res.redirect("/");
});

// User Profile
router.get('/profile', isAuthenticated, (req, res) => {
    res.render('pages/User/userprofile', {
        title: 'User Profile',
        user: req.user,
        layout: false
    });
});

// Update Profile
router.post('/update-profile', isAuthenticated, updateProfile);

module.exports = router;
