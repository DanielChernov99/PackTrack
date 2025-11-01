import React from "react";
import Header from "./Header.jsx";

const Layout = ({ children  }) => {
        <>
            <Header />
            <main>{children }</main>
        </>    
};

export default Layout;