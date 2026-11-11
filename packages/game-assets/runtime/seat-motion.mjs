export const SEAT_PULL = 0.24;
export const STAND_GAP = 0.12;
export const SEAT_OUT = SEAT_PULL + STAND_GAP;

const PULL_OUT_SECONDS = 0.45;
const SLIDE_SECONDS = 0.55;
const HOME_DISTANCE = 0.8;

function ease(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function seatMotionLength(action, clips) {
  return action === 'sit'
    ? PULL_OUT_SECONDS + clips.sit_down + SLIDE_SECONDS
    : SLIDE_SECONDS + clips.stand_up;
}

function sitting(elapsed, clips) {
  if (elapsed < PULL_OUT_SECONDS) {
    return {
      chair: SEAT_OUT * ease(elapsed / PULL_OUT_SECONDS),
      actor: null,
      clip: null,
      done: false,
    };
  }
  const seated = PULL_OUT_SECONDS + clips.sit_down;
  if (elapsed < seated) {
    const closing = ease((elapsed - PULL_OUT_SECONDS) / clips.sit_down);
    return {
      chair: SEAT_PULL + STAND_GAP * (1 - closing),
      actor: SEAT_PULL,
      clip: 'sit_down',
      done: false,
    };
  }
  if (elapsed < seated + SLIDE_SECONDS) {
    const offset = SEAT_PULL * (1 - ease((elapsed - seated) / SLIDE_SECONDS));
    return { chair: offset, actor: offset, clip: 'sit_idle', done: false };
  }
  return { chair: 0, actor: 0, clip: 'typing', done: true };
}

function standing(elapsed, clips) {
  if (elapsed < SLIDE_SECONDS) {
    const offset = SEAT_PULL * ease(elapsed / SLIDE_SECONDS);
    return { chair: offset, actor: offset, clip: 'sit_idle', done: false };
  }
  if (elapsed < SLIDE_SECONDS + clips.stand_up) {
    const opening = ease((elapsed - SLIDE_SECONDS) / clips.stand_up);
    return {
      chair: SEAT_PULL + STAND_GAP * opening,
      actor: SEAT_PULL,
      clip: 'stand_up',
      done: false,
    };
  }
  return { chair: SEAT_OUT, actor: SEAT_PULL, clip: 'idle', done: true };
}

export function seatMotion(action, elapsed, clips) {
  return action === 'sit' ? sitting(elapsed, clips) : standing(elapsed, clips);
}

export function slideBack(yaw, distance) {
  return [-Math.sin(yaw) * distance, -Math.cos(yaw) * distance];
}

export function chairComesHome(seat, player) {
  return Math.hypot(player.x - seat.x, player.z - seat.z) > HOME_DISTANCE;
}
