import { createBrowserRouter } from "react-router-dom";
import MapComponent from "./components/MapComponent";
import Login from "./components/LoginComponent";
import RegisterComponent from "./components/RegisterComponent";

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <Login />,
    },
    {
      path: "/map",
      element: <MapComponent />,
    },
    {
      path: "/register",
      element: <RegisterComponent />,
    },
  ]
);

export default router;
