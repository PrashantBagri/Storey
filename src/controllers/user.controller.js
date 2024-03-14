import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/apiError.js"
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiResponse.js";


const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId);

        const userAccessToken = user.generateAccessToken();
        const userRefreshToken = user.generateRefreshToken();

        user.refreshToken = userRefreshToken;
        await user.save({ validateBeforeSave : false });

        return {userAccessToken, userRefreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token.")
    }
}

const registerUser = asyncHandler(async(req, res)=>{
    //get user data from frontend

    const { fullname, username, email, password } =  req.body

    console.log(email)
    //validation - not empty

    if(
        [fullname, username, email, password].some((field)=>field?.trim() === "")
    ){
        throw new ApiError(400, "Fullname is required.")
    }

    //check if user already exists

    const userExists = await User.findOne({
        $or : [{username}, {email}]
    })

    if(userExists){
        throw new ApiError(409, "Username or Email already exists.")
    } 

    //check for images, check for avatar

    const avatarLocalPath = req.files?.avatar[0]?.path;
    
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files) && req.files.coverImage.length > 0){
            coverImageLocalPath = req.files.avatar[0].path;
    }

    console.log("this is files data", req.files);

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is Required.")
    }

    //upload them to cloudinary, avatar

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar) {
        throw new ApiError(400, "Avatar is Required.")
    }

    //create user object

    const user = await User.create({
        fullname,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email : email,
        password,
        username : username.toLowerCase()
    })

    //remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //check for user creation
    if(!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user.")
    }

    
    //return response

    return res.status(201).json(new ApiResponse(201, createdUser, "User registered successfully."))
});

const loginUser = asyncHandler(async(req,res)=>{
    //req.body -> data

    const {email, username, password} = req.body;

    //username or email

    if(!username || !email){
        throw new ApiError(400, "Username or Email required.")
    }

    //find the user

    const user = await User.findOne({
        $or : [{username}, {email}]
    })

    if(!user) throw new ApiError(404, "User does not exists.");
    //password check

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid) throw new ApiError(400, "Invalid user Credentials.")


    //access token and refresh token

    const {accessToken , refreshToken} =  await generateAccessAndRefreshTokens(user._id);

    //send cookie

    user.refreshToken = refreshToken;

    const options = {
        httpOnly : true,
        secure : true
    }

    return res.status(200).cookie("accessToken", accessToken, options).cookie("refreshToken", refreshToken, options).json(
        new ApiResponse(
            200, 
            {
                user,
                accessToken,
                refreshToken
            },
            "User LoggedIn Successfully."
        )
    )
})

const logoutUser = asyncHandler(async(req, res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                refreshToken : undefined
            }
        },
        {
            new : true
        }
    )

    const options = {
        httpOnly : true,
        secure : true
    }

    return res.status(200).clearCookie("accessToken", options).clearCookie("refreshToken", options).json(
        new ApiResponse(200, {}, "User Logged Out.")
    )
})

export {registerUser, loginUser, logoutUser}