import axios from "axios";

export const backendAxios = axios.create({
    baseURL: "http://192.168.1.14:5141"
})