import React from "react";
import { createRoot } from "react-dom/client";
import { Route, Switch, Redirect } from "wouter";

import { ThemeProvider, createTheme } from "@mui/material/styles";

import Theme from "@layout/theme";
import Navbar from "@layout/navbar";

import FlowsPage from "@pages/flows";
import DashboardPage from "@pages/dashboard";

import "./index.css";

const domNode = document.getElementById("root")!;
const root = createRoot(domNode);

const theme = createTheme(Theme);

const App = () => {
	return (
		<ThemeProvider theme={theme}>
			<Navbar />
			<Switch>
				<Route path='/dashboard' component={DashboardPage} />
				<Route path='/flows/:id?' component={FlowsPage} />
				<Route path='*'>
					<Redirect to='/dashboard' />
				</Route>
			</Switch>
		</ThemeProvider>
	);
};

root.render(<App />);

