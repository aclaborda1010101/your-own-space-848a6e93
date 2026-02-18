import "./index.css";
import { initSafeStorage } from "./lib/safeStorage";

// Prevent blank screens in private/strict browser modes where storage APIs throw.
initSafeStorage();

// Defer app import until after storage is made safe.
void import("./bootstrap");

