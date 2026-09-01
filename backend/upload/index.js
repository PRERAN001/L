
const cloudinary = require('cloudinary').v2;


cloudinary.config({cloud_name:"dxn29vjxu",api_key:"593853593331226",api_secret:"9IHTOoErAOvcWUQ8JUda8vWWJls",
  secure: true
});

const uploadImage = async (imagePath) => {
 
    const options = {
      use_filename: true,
      unique_filename: false,
      overwrite: true,
    };

    try {      
      const result = await cloudinary.uploader.upload(imagePath, options);
      console.log(result);
      return result.public_id;
    } catch (error) {
      console.error(error);
    }
};

const getAssetInfo = async (publicId) => {


    const options = {
      colors: true,
    };

    try {
 
        const result = await cloudinary.api.resource(publicId, options);
        console.log(result);
        return result.colors;
        } catch (error) {
        console.error(error);
    }
};
console.log(cloudinary.config());