const multer = require('multer');


const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // console.log(req)
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: diskStorage });

module.exports = upload;
