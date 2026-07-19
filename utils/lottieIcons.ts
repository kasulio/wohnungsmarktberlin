import type { AnimationItem } from "lottie-web";

type LottieLight = {
  loadAnimation: (params: {
    container: Element;
    renderer: "svg";
    loop: boolean;
    autoplay: boolean;
    animationData: unknown;
    initialSegment?: [number, number];
    rendererSettings?: { preserveAspectRatio?: string };
  }) => AnimationItem;
};

type IconState = {
  name: string;
  time: number;
  duration: number;
  isDefault: boolean;
};

export type LottieIconPlayer = {
  play: () => void;
  playFromBeginning: () => void;
  goToLastFrame: () => void;
  pause: () => void;
  direction: 1 | -1;
  loop: boolean;
  readonly isPlaying: boolean;
};

export type LottieIconExpose = {
  ensureLoaded: () => Promise<LottieIconPlayer | null>;
  readonly playerInstance: LottieIconPlayer | null;
};

export type LottieIconHost = HTMLElement & {
  playerInstance?: LottieIconPlayer;
  ensureLoaded?: () => Promise<LottieIconPlayer | null>;
};

export function getLottieIconHost(
  el: Element | null | undefined,
): LottieIconHost | undefined {
  return el ? (el as LottieIconHost) : undefined;
}

let lottiePromise: Promise<LottieLight> | null = null;
const iconCache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

export function loadLottieLight() {
  lottiePromise ??= import("lottie-web/build/player/lottie_light").then(
    (mod) => mod.default as LottieLight,
  );
  return lottiePromise;
}

export function loadIconData(src: string) {
  const cached = iconCache.get(src);
  if (cached) return Promise.resolve(cached);

  const existing = inflight.get(src);
  if (existing) return existing;

  const promise = fetch(src)
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load icon: ${src}`);
      return response.json();
    })
    .then((data) => {
      iconCache.set(src, data);
      return data;
    })
    .finally(() => inflight.delete(src));

  inflight.set(src, promise);
  return promise;
}

function parseStates(animationData: {
  markers?: Array<{ tm: number; dr: number; cm: string }>;
}): IconState[] {
  return (animationData.markers ?? [])
    .map((marker) => {
      const [prefix = "", name] = marker.cm.split(":");
      return {
        name: name || prefix,
        time: marker.tm,
        duration: marker.dr,
        isDefault: Boolean(name && prefix.includes("default")),
      };
    })
    .filter((state) => state.duration > 0 && state.name.length > 0);
}

function resolveState(
  states: IconState[],
  preferred?: string | null,
): IconState | undefined {
  if (!states.length) return undefined;
  if (preferred) {
    return (
      states.find((state) => state.name === preferred) ??
      states.find((state) => state.isDefault) ??
      states[0]
    );
  }
  return states.find((state) => state.isDefault) ?? states[0];
}

export async function createLottieIconPlayer(options: {
  container: Element;
  src: string;
  state?: string | null;
}): Promise<{
  player: LottieIconPlayer;
  destroy: () => void;
}> {
  const [lottie, animationData] = await Promise.all([
    loadLottieLight(),
    loadIconData(options.src),
  ]);

  const states = parseStates(
    animationData as {
      markers?: Array<{ tm: number; dr: number; cm: string }>;
    },
  );
  const active = resolveState(states, options.state);
  const segment: [number, number] | undefined = active
    ? [active.time, active.time + active.duration + 1]
    : undefined;

  const animation = lottie.loadAnimation({
    container: options.container,
    renderer: "svg",
    loop: false,
    autoplay: false,
    animationData,
    ...(segment ? { initialSegment: segment } : {}),
    rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
  });

  let direction: 1 | -1 = 1;

  const player: LottieIconPlayer = {
    play() {
      animation.setDirection(direction);
      animation.play();
    },
    playFromBeginning() {
      direction = 1;
      animation.setDirection(1);
      if (segment) {
        animation.playSegments(segment, true);
      } else {
        animation.goToAndPlay(0, true);
      }
    },
    goToLastFrame() {
      // currentRawFrame is segment-relative; totalFrames is the active segment length.
      animation.goToAndStop(Math.max(0, animation.totalFrames - 1), true);
    },
    pause() {
      animation.pause();
    },
    get direction() {
      return direction;
    },
    set direction(value: 1 | -1) {
      direction = value;
      animation.setDirection(value);
    },
    get loop() {
      return Boolean(animation.loop);
    },
    set loop(value: boolean) {
      animation.loop = value;
    },
    get isPlaying() {
      return !animation.isPaused;
    },
  };

  await new Promise<void>((resolve) => {
    if (animation.isLoaded) {
      resolve();
      return;
    }
    animation.addEventListener("DOMLoaded", () => resolve());
  });

  return {
    player,
    destroy() {
      animation.destroy();
    },
  };
}
