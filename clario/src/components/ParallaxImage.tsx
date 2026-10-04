"use client";

import Image, { type StaticImageData } from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

type Props = {
  src: StaticImageData;
  alt: string;
  sizes: string;
  className?: string;
  imageClassName?: string;
  /** Parallax travel as a percentage of the frame height (kept small so the image is barely enlarged) */
  strength?: number;
  priority?: boolean;
};

/** Image that zooms in gently on reveal and drifts slightly with scroll. */
export function ParallaxImage({ src, alt, sizes, className = "", imageClassName = "", strength = 4, priority }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [`-${strength}%`, `${strength}%`]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`} data-cursor="media">
      <motion.div
        className="absolute inset-x-0"
        style={{ top: `-${strength}%`, bottom: `-${strength}%`, ...(reduce ? {} : { y }) }}
        initial={{ scale: 1.06 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, margin: "0px 0px -10% 0px" }}
        transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <Image src={src} alt={alt} fill sizes={sizes} placeholder="blur" priority={priority} quality={92} className={`object-cover ${imageClassName}`} />
      </motion.div>
    </div>
  );
}
