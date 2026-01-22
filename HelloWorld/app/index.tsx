import { Redirect } from 'expo-router';

//the app defaults to the index file on the root directory

export default function Home_Page_Redirect(){
    return <Redirect href="/Home_Page" />;
    
}

//the "../" you will see just means to look at the parent directory of the directory the file is currently in