import './App.css';
import {
  Row,
  Col,
  Container,
  Dropdown,
  DropdownButton,
  Form,
  Button,
} from 'react-bootstrap';
import { useState, useEffect, useRef } from 'react';
import {
  TW3TContent,
  TW3TSigner,
  TW3TVerifier,
  PolkaJsSigner,
  PolkaJsVerifier,
  TOML,
  section,
} from 'tw3t';

import { cryptoWaitReady } from '@polkadot/util-crypto';
import { stringShorten } from '@polkadot/util';
import { loadSigningAccounts } from './extension';

let initializeAccounts = async () => {
  await cryptoWaitReady();
  return loadSigningAccounts();
};

let getInitalContent = () => {
  let statement = `Welcome to example.dapp.io!\nSign this message and accept the example.dapp.io Terms of Service: example.dapp.io/terms`;
  let sigSpec = {
    algorithm: 'sr25519',
    token_type: 'TW3T',
    address_type: 'ss58',
  };
  let claimInfo = {
    address: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
  };

  let exp = new Date();
  exp.setHours(exp.getHours() + 24); // expire in 24 hours
  let content = new TW3TContent(claimInfo, sigSpec, statement)
    .setAudience('uri:test')
    .setExpiration(exp);
  let tomlObject = {
    information: section(content.claimInfo),
    specification: section(content.sigSpec),
  };

  return { statement, tomlContent: TOML.stringify(tomlObject) };
};

let createToken = async (statement, claimInfo, sigSpec, signingAccount) => {
  let content = new TW3TContent(claimInfo, sigSpec, statement);
  let polkaJsSigner = new PolkaJsSigner(signingAccount);
  let tw3tSigner = new TW3TSigner(polkaJsSigner, content);
  let { base64Content, base64Sig } = await tw3tSigner.getSignature();
  return `${base64Content}.${base64Sig}`;
};

let verifyToken = async (token) => {
  let polkaJsVerifier = new PolkaJsVerifier();
  let tw3tVerifier = new TW3TVerifier(polkaJsVerifier);
  let content = await tw3tVerifier.verify(token);
  return content;
};

function getAccountDisplayStr(account) {
  let str = '';
  if (account?.meta?.name) str += `(${account?.meta?.name}) `;
  if (account?.address) str += `${stringShorten(account?.address)}`;
  return str;
}

function AccountDropdown({
  signingAccounts,
  selectedSigningAccount,
  selectHandler,
}) {
  signingAccounts = signingAccounts.filter((sa) => sa?.account?.address);
  let title = getAccountDisplayStr(selectedSigningAccount?.account);
  return (
    <DropdownButton
      id="dropdown-item-button"
      variant="transparent"
      className="border border-primary rounded"
      title={title}
      onSelect={(selectedIdx) =>
        selectHandler && selectHandler(signingAccounts[selectedIdx])
      }
    >
      {signingAccounts.map((sa, idx) => {
        let text = getAccountDisplayStr(sa?.account);
        return (
          <Dropdown.Item as="button" eventKey={idx}>
            {text}
          </Dropdown.Item>
        );
      })}
    </DropdownButton>
  );
}
function resetTextareaHeight(textareaRef) {
  if (textareaRef?.current) {
    textareaRef.current.style = { ...textareaRef.current.style, height: '0px' };
    const scrollHeight = textareaRef.current.scrollHeight || 0;
    textareaRef.current.style.height = scrollHeight + 'px';
  }
}
function App() {
  let { statement: initStatement, tomlContent: initTomlContent } =
    getInitalContent() || {};
  console.log(getInitalContent());
  let [signingAccounts, setSigningAccounts] = useState([]);
  let [signingAccount, setSigningAccount] = useState();
  let [statement, setStatement] = useState(initStatement);
  let [tomlContent, setTomlContent] = useState(initTomlContent);
  let [tomlContentError, setTomlContentError] = useState();
  let [token, setToken] = useState('');
  let [tokenError, setTokenError] = useState();
  let [isValid, setIsValid] = useState();
  let statementTextareaRef = useRef();
  let tomlContentTextareaRef = useRef();
  let tokenTextareaRef = useRef();

  useEffect(() => {
    initializeAccounts().then((accounts) => {
      accounts && console.log(accounts[0]?.address || 'noaddress');
      setSigningAccounts(accounts);
      accounts?.[0]?.account?.address &&
        setTomlContentAddress(accounts?.[0]?.account?.address);
      setSigningAccount(accounts[0]);
    });
  }, []);

  useEffect(() => {
    setTomlContentError('');
    resetTextareaHeight(statementTextareaRef);
    resetTextareaHeight(tomlContentTextareaRef);

    setToken('');
    let tomlContentToml;
    let contentIsInvalid = false;
    try {
      tomlContentToml = TOML.parse(tomlContent);
    } catch (err) {
      setTomlContentError(err?.message || err);
      contentIsInvalid = true;
    }
  }, [signingAccount, tomlContent, statement]);

  useEffect(() => {
    setTokenError('');
    token &&
      verifyToken(token)
        .then((content) => {
          console.log(content);
          setIsValid(true);
        })
        .catch((err) => setTokenError(err?.message || err));
  }, [token]);

  const SignBtnClickHandler = () => {
    if (!tomlContentError && signingAccount) {
      let tomlObject = TOML.parse(tomlContent);
      createToken(
        statement,
        tomlObject?.information,
        tomlObject?.specification,
        signingAccount
      )
        .then((token) => setToken(token))
        .catch((err) => {
          setTokenError(err?.message || err);
        });
    }
  };
  const setTomlContentAddress = (address) => {
    !tomlContentError &&
      setTomlContent((tomlContent) => {
        let newTomlContent = tomlContent;
        try {
          let tomlContentObj = TOML.parse(tomlContent);
          tomlContentObj.information.address = address;
          newTomlContent = TOML.stringify(tomlContentObj);
        } catch (err) {
          console.log(
            'can not change the toml.information.address since toml content is not in a valid toml format.'
          );
        }
        return newTomlContent;
      });
  };
  const selectAccountHandler = (signingAccount) => {
    setSigningAccount(signingAccount);
    signingAccount?.account?.address &&
      setTomlContentAddress(signingAccount?.account?.address);
  };

  return (
    <Container className="py-5">
      <Row>
        <Col xl="12" className="text-break d-flex flex-column py-2">
          <Form.Group className="my-2">
            <Form.Label>
              <strong>Statement</strong>
            </Form.Label>
            <Form.Control
              as="textarea"
              ref={statementTextareaRef}
              className="w-100 fw-light"
              value={statement}
              onChange={(e) => setStatement(e?.target?.value)}
            />
          </Form.Group>
          <Form.Group className="my-2">
            <Form.Label>
              <strong>Toml Content</strong>
            </Form.Label>
            <Form.Control
              as="textarea"
              ref={tomlContentTextareaRef}
              className="w-100 fw-light"
              value={tomlContent}
              onChange={(e) => setTomlContent(e?.target?.value)}
            />
            {tomlContentError && (
              <Form.Text className="text-danger">{tomlContentError}</Form.Text>
            )}
          </Form.Group>
        </Col>
        <Col xl="12" className="d-flex justify-content-center py-2">
          <AccountDropdown
            signingAccounts={signingAccounts}
            selectedSigningAccount={signingAccount}
            selectHandler={(signingAccount) =>
              selectAccountHandler(signingAccount)
            }
          />
        </Col>
        <Col xl="12" className="d-flex justify-content-center py-2">
          <Button
            className="ms-2"
            onClick={() => {
              SignBtnClickHandler();
            }}
          >
            Sign token
          </Button>
        </Col>
        <Col xl="12" className="text-break py-2">
          <Form.Group className="my-2">
            <Form.Label>
              <strong>Encoded JW3T</strong>
            </Form.Label>
            <Form.Control
              as="textarea"
              ref={tokenTextareaRef}
              style={{ resize: 'none' }}
              className="w-100 fw-light"
              value={token}
            />
            {tokenError && (
              <Form.Text className="text-danger">{tokenError}</Form.Text>
            )}
          </Form.Group>
        </Col>
      </Row>
    </Container>
  );
}

export default App;
