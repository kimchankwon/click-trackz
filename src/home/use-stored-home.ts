import { useEffect } from "react";

import { deviceValue } from "@/lib/device-value";
import { HOME_FORMAT, parseStoredHome, type MyGroups } from "./stored-home";

const home = deviceValue("home", parseStoredHome);

export const useStoredHome = home.useValue;

export const forgetStoredHome = home.forget;

export function useKeepHomeOnDevice(groups: MyGroups | undefined, isAnonymous: boolean | undefined) {
  useEffect(() => {
    if (groups === undefined || isAnonymous === undefined) return;
    home.save({ format: HOME_FORMAT, isAnonymous, groups });
  }, [groups, isAnonymous]);
}
