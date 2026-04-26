"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const HeroSection = () => {
  const imageRef = useRef(null);

  useEffect(() => {
    const imageElement = imageRef.current;

    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const scrollThreshold = 100;

      if (scrollPosition > scrollThreshold) {
        imageElement.classList.add("scrolled");
      } else {
        imageElement.classList.remove("scrolled");
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section className="w-full pb-10 pt-24 md:pt-28">
      <div className="space-y-6 text-center">
        <div className="mx-auto max-w-5xl space-y-6">
          <p className="font-label text-xs text-muted-foreground">Career OS for builders</p>
          <h1 className="gradient-title text-5xl font-bold md:text-6xl lg:text-7xl xl:text-8xl">
            Your AI Career Coach for
            <br />
            Professional Success
          </h1>
          <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
            Advance your career with personalized guidance, interview prep, and
            AI-powered tools for job success.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/dashboard">
            <Button size="lg" className="px-8">
              Get Started
            </Button>
          </Link>
          <Link href="https://www.youtube.com/roadsidecoder">
            <Button size="lg" variant="outline" className="px-8">
              Watch Demo
            </Button>
          </Link>
        </div>
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 pt-1">
          <span className="rounded-sm border border-border/70 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">Live Interview Rooms</span>
          <span className="rounded-sm border border-border/70 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">Company Intel</span>
          <span className="rounded-sm border border-border/70 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">Reverse Recruiter</span>
          <span className="rounded-sm border border-border/70 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">Offer Copilot</span>
        </div>
        <div className="hero-image-wrapper mt-5 md:mt-0">
          <div ref={imageRef} className="hero-image">
            <Image
              src="/banner.jpeg"
              width={1280}
              height={720}
              alt="Dashboard Preview"
              className="mx-auto border border-border/70 shadow-2xl"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
