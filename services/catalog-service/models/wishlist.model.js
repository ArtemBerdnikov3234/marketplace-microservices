const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: Number, // ID пользователя приходит из Auth Service (он там числовой из Postgres)
      required: true,
      unique: true, // У одного юзера только один вишлист
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId, // Ссылка на товар в Mongo
        ref: "Product",
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Wishlist", wishlistSchema);
