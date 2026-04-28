import CustomText from "@/src/components/custom_ui/custom_text";
import AddContactOverlay from "@/src/components/settings/user_settings/add_contact_overlay";
import { useState } from "react";

function User() {
  const [isAddContactOverlayVisible, setIsAddContactOverlayVisible] =
    useState(false);

  return (
    <>
      <CustomText>User settings</CustomText>
      <AddContactOverlay
        isAddContactOverlayVisible={{
          value: isAddContactOverlayVisible,
          set: setIsAddContactOverlayVisible,
        }}
      />
    </>
  );
}

export default User;
