const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    googleId: String,
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    username: {
      type: String,
      unique: true
    },
    avatar: String,
    bio: {
      type: String,
      default: ""
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", UserSchema);
