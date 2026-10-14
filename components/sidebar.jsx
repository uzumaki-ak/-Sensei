import Link from "next/link";
import Image from "next/image";
import { Circle } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { checkUser } from "@/lib/checkUser";
import { hasGmailDraftScope } from "@/lib/gmail-scopes";
import { Button } from "@/components/ui/button";
import GmailConnectButton from "@/components/gmail-connect-button";
import SidebarNav from "@/components/sidebar-nav";

export default async function Sidebar() {
  const user = await checkUser();
  const isGmailConnected = !!user?.gmailToken;
  const needsGmailReconnect = isGmailConnected && !hasGmailDraftScope(user?.gmailToken);

  return (
    <aside className="app-sidebar fixed left-0 top-0 z-50 hidden h-screen w-72 flex-col border-r border-border/60 bg-card/95 backdrop-blur-md md:flex">
      <div className="flex h-16 items-center justify-between border-b border-border/60 px-6">
        <Link href="/" className="rounded-sm bg-neutral-950 px-2 py-1 transition-opacity hover:opacity-80">
          <Image src="/logo.png" alt="Sensai Logo" width={140} height={42} className="h-9 w-auto object-contain" />
        </Link>
        <Circle className="h-3.5 w-3.5 fill-foreground/30 text-foreground/30" />
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
        <SignedIn><SidebarNav /></SignedIn>
      </nav>

      <div className="border-t border-border/60">
        <SignedIn>
          <div className="px-4 pb-1 pt-3">
            <GmailConnectButton isConnected={isGmailConnected} needsReconnect={needsGmailReconnect} />
          </div>
          <div className="flex items-center justify-between px-6 pb-4 pt-2">
            <span className="text-sm font-medium">Account</span>
            <UserButton
              appearance={{ elements: {
                avatarBox: "w-8 h-8",
                userButtonPopoverCard: "shadow-xl",
                userPreviewMainIdentifier: "font-semibold",
              } }}
              afterSignOutUrl="/"
            />
          </div>
        </SignedIn>
        <SignedOut>
          <div className="p-4">
            <SignInButton><Button variant="outline" className="w-full">Sign In</Button></SignInButton>
          </div>
        </SignedOut>
      </div>
    </aside>
  );
}
