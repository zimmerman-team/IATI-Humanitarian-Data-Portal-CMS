/* base */
import React from 'react';
import styled from 'styled-components';
import Typography from '@material-ui/core/Typography';

/* components */
import { ContainedButton } from 'app/components/inputs/buttons/ContainedButton';
import { LayoutModel } from 'app/modules/SignIn/models';
import { FormPasswordField } from '../../../../components/inputs/textfields/FormPasswordField';
import { FormSingleLineField } from '../../../../components/inputs/textfields/FormSingleLineField';

const Container = styled.div`
  && {
    left: 0;
    height: 100vh;
    display: flex;
    overflow-y: auto;
    align-items: center;
    justify-content: center;
    background-color: #ffffff;
  }
`;

const Form = styled.div`
  width: 300px;
  display: flex;
  flex-direction: column;
`;

const Header = styled(Typography)`
  && {
    margin-bottom: 45px;
  }
`;

export const InputForm = (props: LayoutModel) => {
  return (
    <Container>
      <Form>
        <Header variant="h3">
          <span role="img" aria-label="emoji">
            👋
          </span>{' '}
          Hello
        </Header>
        <FormSingleLineField
          fullWidth
          label="Email"
          id="login-email"
          value={props.email}
          setValue={props.setEmail}
        />
        <FormPasswordField
          fullWidth
          label="Password"
          id="login-password"
          value={props.password}
          showPass={props.showPass}
          setValue={props.setPassword}
          setShowPass={props.setShowPass}
        />
        <ContainedButton
          text="Sign in"
          onClick={() => props.login()}
          disabled={props.email === '' || props.password === ''}
        />
      </Form>
    </Container>
  );
};
