from hero_kit import HeroPart

CENTER_MOUNT = 'mount_center'
BAR_HALF_LENGTH = 0.3
BAR_DEPTH = 0.06
BAR_HEIGHT = 0.056
BAR_LIFT = 0.012


def driver(speaker, center, radius, ring, segments=28):
    speaker.revolve(center, 'y', [
        (radius, 0.0, 'body'),
        (radius, 0.005, ring),
        (radius * 0.86, 0.005, ring),
        (radius * 0.82, 0.002, 'soft'),
        (radius * 0.42, -0.012, 'soft'),
        (radius * 0.36, -0.005, 'trim'),
        (radius * 0.2, 0.004, 'trim'),
        (0.001, 0.007, 'trim'),
    ], segments=segments, smooth=True)


def build_speaker(name='speaker_a'):
    speaker = HeroPart(name)
    speaker.slab_y(0, 0.135, 0.076, 0.135, 0.022, [
        (-0.09, 0.008, 'metal'),
        (-0.08, 0.0, 'metal'),
        (0.06, 0.0, 'metal'),
        (0.07, 0.004, 'body'),
        (0.0725, 0.01, 'body'),
    ], corner=5)
    driver(speaker, (0, 0.0725, 0.197), 0.04, 'accent')
    driver(speaker, (0, 0.0725, 0.083), 0.064, 'screen')
    return speaker


def build_speaker_bar(name='speaker_b'):
    bar = HeroPart(name)
    middle = BAR_LIFT + BAR_HEIGHT / 2
    bar.rounded_box((0, 0, middle), (BAR_HALF_LENGTH * 2, BAR_DEPTH, BAR_HEIGHT), 'body', radius=0.018, segments=3)
    front = BAR_DEPTH / 2
    bar.rounded_box((0, front, middle + 0.002), (BAR_HALF_LENGTH * 2 - 0.09, 0.005, BAR_HEIGHT - 0.022), 'soft', radius=0.002, segments=1)
    bar.rounded_box((0, front + 0.001, BAR_LIFT + 0.007), (BAR_HALF_LENGTH * 2 - 0.1, 0.006, 0.004), 'strip', radius=0.0015, segments=1)
    for side in (-1, 1):
        bar.rounded_box((side * 0.2, 0, BAR_LIFT / 2 + 0.002), (0.05, 0.04, BAR_LIFT), 'soft', radius=0.004, segments=1)
        bar.revolve((side * (BAR_HALF_LENGTH - 0.004), 0, middle), 'x', [
            (0.019, 0.0, 'metal'),
            (0.019, side * 0.007, 'metal'),
            (0.014, side * 0.008, 'accent'),
            (0.011, side * 0.008, 'soft'),
            (0.001, side * 0.0085, 'soft'),
        ], segments=20, smooth=False)
    bar.revolve((0.24, 0, BAR_LIFT + BAR_HEIGHT - 0.001), 'z', [
        (0.011, 0.0, 'metal'),
        (0.011, 0.006, 'metal'),
        (0.008, 0.0075, 'accent'),
        (0.001, 0.0075, 'accent'),
    ], segments=20, smooth=False)
    return bar
