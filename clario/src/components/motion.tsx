"use client";

import { motion, type HTMLMotionProps, type Variants } from "framer-motion";

export const EASE = [0.16, 1, 0.3, 1] as const;

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 1.1, ease: EASE, delay },
  }),
};

type RevealProps = HTMLMotionProps<"div"> & { delay?: number; as?: "div" | "li" | "article" | "header" };

/** Fade + slide + soft focus as the element scrolls into view. */
export function Reveal({ delay = 0, as = "div", children, ...rest }: RevealProps) {
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      variants={revealVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      custom={delay}
      {...rest}
    >
      {children}
    </Comp>
  );
}
