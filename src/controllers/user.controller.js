import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token."
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //get user data from frontend

  const { fullname, username, email, password } = req.body;

  console.log(email);
  //validation - not empty

  if (
    [fullname, username, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "Fullname is required.");
  }

  //check if user already exists

  const userExists = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (userExists) {
    throw new ApiError(409, "Username or Email already exists.");
  }

  //check for images, check for avatar

  const avatarLocalPath = req.files?.avatar[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.avatar[0].path;
  }

  console.log("this is files data", req.files);

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is Required.");
  }

  //upload them to cloudinary, avatar

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar is Required.");
  }

  //create user object

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email: email,
    password,
    username: username.toLowerCase(),
  });

  //remove password and refresh token field from response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  //check for user creation
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user.");
  }

  //return response

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered successfully."));
});

const loginUser = asyncHandler(async (req, res) => {
  //req.body -> data

  const { email, username, password } = req.body;

  //username or email

  if (!username && !email) {
    throw new ApiError(400, "Username or Email required.");
  }

  //find the user

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exists.");
  }
  //password check

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid user Credentials.");
  }

  //access token and refresh token

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  //send cookie

  user.refreshToken = refreshToken;

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user,
          accessToken,
          refreshToken,
        },
        "User LoggedIn Successfully."
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out."));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingAccessToken = req.cookies.refreshToken || req.body.cookies;
  console.log("incomingAccessToken : ", incomingAccessToken);

  if (!incomingAccessToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingAccessToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken._id);

    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token");
    }

    if (incomingAccessToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh Token Expired.");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookies("accessToken", accessToken, options)
      .cookies("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access Token Refreshed Successfully."
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh Token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword, confPassword } = req.body;

  if (newPassword !== confPassword) {
    throw new ApiError(400, "Please Confirm Your password again.");
  }

  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Incorrect Old Password.");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(201)
    .json(new ApiResponse(201, {}, "Password Changed Successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current User fetched Successfully."));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if (!(fullname || email)) {
    throw new ApiError(400, "All Fields are Required.");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname,
        email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully."));
});

const updateAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar File is missing.");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading avatar.");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(201)
    .json(new ApiResponse(201, user, "Avatar Updated Successfully"));
});

const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image File is missing.");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading Cover Image.");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(201)
    .json(new ApiResponse(201, user, "Cover Image Updated Successfully"));
});

const getUserChannelProfile = asyncHandler(async(req, res)=>{
  const {username} = req.params;

  if(!username?.trim()){
    throw new ApiError(400, "Username is missing.")
  }

  const channel = await User.aggregate([
    {
      $match : {
        username : username?.toLowerCase()
      }
    },
    {
      $lookup : {
        from : "subscriptions",
        localField : "_id",
        foreignField : "channel",
        as : "subscribers"
      }
    },
    {
      $lookup : {
        from : "subscriptions",
        localField : "_id",
        foreignField : "subscriber",
        as : "subscribedTo"
      }
    },
    {
      $addFields : {
        subscribersCount : {
          $size : "$subscribers"
        },
        channelSubscribedToCount : {  
          $size : "$subscribedTo"
        },
        isSubscribed : {
          $cond :{
            if : {$in : [req.user?._id, "$subscribers.subscriber"]},
            then : true,
            else : false
          }
        }
      },
    },
    {
      $project : {
        fullname : 1,
        username : 1,
        email : 1,
        subscribersCount : 1,
        channelSubscribedToCount :1,
        isSubscribed :1,
        avatar : 1,
        coverImage : 1
      }
    }

  ])

  console.log(channel)

  if(!channel?.length){
    throw new ApiError(404, "Channel Does not Exists.")
  }

  return res.status(200).json(new ApiResponse(200, channel[0], "User channel fetched successfully."))
})

const getWatchHistory = asyncHandler(async(req, res)=>{
   const user = await User.aggregate([
      {
        $match : {
          _id : new mongoose.Types.ObjectId.createFromTime(req.user?._id)
        }
      },
      {
        $lookup:{
          from : "videos",
          localField : "watchHistory",
          foreignField : "_id",
          as : "watchHistory",
          pipeline :[
            {
              $lookup :{
                from : "users",
                localField : "owner",
                ForeignField : "_id",
                as : "owner",
                pipeline : [
                  {
                    $project : {
                      fullname : 1,
                      username : 1,
                      avatar : 1
                    }
                  }
                ]
              }
            },
            {
              $addFields : {
                onwer : {
                  $first  : "$owner"
                }
              }
            }
          ]
        }
      }
   ])

   return res.status(200).json(new ApiResponse(200, user[0].watchHistory, "Watch History fetched Successfully."))
})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateAvatar,
  updateCoverImage,
  getUserChannelProfile,
  getWatchHistory
};
