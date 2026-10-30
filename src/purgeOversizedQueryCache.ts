import { dropOversizedQueryCache } from "./components/atomic-crm/providers/commons/queryCachePersistence";

// An earlier version could fill the phone's whole storage with saved data,
// leaving no room to sign in. main.tsx imports this module before the app, so
// the room is back before the sign-in client first reads or writes storage.
dropOversizedQueryCache();
