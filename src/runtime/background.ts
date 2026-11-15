import type { AreaId } from "../core/model";
import { BACKGROUND_ATTRIBUTE, cssUrl } from "./css";

/** Creates an overlay that fades between independently sized images. */
export const createBackground = (area: AreaId) => {
  const element = document.createElement("div");
  element.setAttribute(BACKGROUND_ATTRIBUTE, area);
  element.setAttribute("aria-hidden", "true");
  let front = document.createElement("div");
  let back = document.createElement("div");
  element.append(front, back);
  let displayedUrl: string | undefined;
  let pending: { url: string } | undefined;
  let animations: Animation[] = [];

  const cancelAnimations = () => {
    for (const animation of animations) {
      animation.cancel();
    }
    animations = [];
  };

  const show = async (url: string, duration: number): Promise<void> => {
    if (pending?.url === url) {
      return;
    }
    pending = undefined;
    if (displayedUrl === url) {
      return;
    }

    const image = new Image();
    const request = { url };
    pending = request;
    image.src = url;
    const decoded = await image.decode().then(
      () => true,
      () => false
    );
    if (pending !== request) {
      return;
    }
    pending = undefined;
    if (!decoded) {
      return;
    }

    cancelAnimations();
    const outgoing = front;
    const incoming = back;
    incoming.style.backgroundImage = cssUrl(url);
    incoming.style.opacity = "1";
    outgoing.style.opacity = "0";
    if (displayedUrl !== undefined && duration > 0 && element.isConnected) {
      // In the isolated group, plus-lighter adds the two opacity weights without dimming their overlap.
      const timing = { duration: duration * 1000, easing: "ease-in-out" };
      const fadeOut = outgoing.animate([{ opacity: 1 }, { opacity: 0 }], timing);
      const fadeIn = incoming.animate([{ opacity: 0 }, { opacity: 1 }], timing);
      animations = [fadeOut, fadeIn];
      fadeIn.onfinish = () => {
        if (animations.includes(fadeIn)) {
          outgoing.style.removeProperty("background-image");
          animations = [];
        }
      };
    } else {
      outgoing.style.removeProperty("background-image");
    }
    front = incoming;
    back = outgoing;
    displayedUrl = url;
  };

  const dispose = () => {
    pending = undefined;
    cancelAnimations();
    element.remove();
  };

  return { element, show, dispose };
};
