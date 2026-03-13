import { useState } from "react";
import { Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { PotusChatMvp } from "./PotusChatMvp";

export function PotusFloatingChat() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-24 right-4 z-[60] lg:bottom-6 lg:right-6">
        <Button
          size="lg"
          className="h-14 rounded-full px-5 shadow-lg gap-2"
          onClick={() => setOpen(true)}
        >
          <Shield className="h-5 w-5" />
          POTUS
        </Button>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="h-[88vh] max-h-[88vh]">
          <DrawerHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle>POTUS</DrawerTitle>
                <DrawerDescription>Chat flotante global para coordinar y ejecutar.</DrawerDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <PotusChatMvp />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
