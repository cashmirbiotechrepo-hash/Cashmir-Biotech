"use client";
import React from "react";

/**
 * Scroll state with hysteresis — avoids flicker when bouncing near the threshold.
 */
export function useScrollPinned(enterAbove = 28, exitBelow = 10) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled((prev) => {
        if (y >= enterAbove) return true;
        if (y <= exitBelow) return false;
        return prev;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [enterAbove, exitBelow]);

  return scrolled;
}

export function useScroll(threshold: number) {
	const [scrolled, setScrolled] = React.useState(false);

	const onScroll = React.useCallback(() => {
		setScrolled(window.scrollY > threshold);
	}, [threshold]);

	React.useEffect(() => {
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	}, [onScroll]);

	// also check on first load
	React.useEffect(() => {
		onScroll();
	}, [onScroll]);

	return scrolled;
}
