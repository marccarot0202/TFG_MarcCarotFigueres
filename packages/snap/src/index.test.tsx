import { expect } from '@jest/globals';
import type { SnapConfirmationInterface } from '@metamask/snaps-jest';
import { installSnap } from '@metamask/snaps-jest';
import { Box, Text, Bold } from '@metamask/snaps-sdk/jsx';

describe('onRpcRequest', () => {
  describe('hello', () => {
    it('shows a confirmation dialog', async () => {
      const { request } = await installSnap();

      const origin = 'Jest';
      const response = request({
        method: 'hello',
        origin,
      });

      const ui = (await response.getInterface()) as SnapConfirmationInterface;
      expect(ui.type).toBe('confirmation');
      expect(ui).toRender(
        <Box>
          <Text>
            Hola, <Bold>{origin}</Bold>!
          </Text>
          <Text>Aquesta confirmació comprova la comunicació amb el Snap.</Text>
          <Text>La connexió funciona correctament.</Text>
        </Box>,
      );

      await ui.ok();

      expect(await response).toRespondWith(true);
    });
  });

  it('throws an error if the requested method does not exist', async () => {
    const { request } = await installSnap();

    const response = await request({
      method: 'foo',
    });

    expect(response).toRespondWithError({
      code: -32603,
      message: 'Mètode no trobat.',
      stack: expect.any(String),
    });
  });
});
