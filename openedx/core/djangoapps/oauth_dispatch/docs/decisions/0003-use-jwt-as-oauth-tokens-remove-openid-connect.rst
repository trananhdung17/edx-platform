3. Use JWT as OAuth2 Tokens; Remove OpenID Connect
--------------------------------------------------

Status
------

Accepted

Context
-------

The edX system has external OAuth2 client applications, including edX Mobile apps
and external partner services. In addition, there are multiple edX microservices
that are OAuth2 Clients of the LMS.

Some of the internal microservice clients require `OpenID Connect`_ features.
Specifically, they make use of the `ID Token`_ extension to get user profile
details from the LMS via the OAuth protocol. The ID Token can also be forwarded
from one microservice to another, allowing the recipient microservice to
validate the identity of the token's owner without needing to reconnect with a
centralized LMS.

We have integrated our fork of DOP_ with support for OpenID Connect. So, an
access_token request with a DOP client::

    curl -X POST -d "client_id=abc&client_secret=def&grant_type=client_credentials" http://localhost:18000/oauth2/access_token/

includes an id_token field::

    {
        "access_token": "xyz",
        "id_token": <BASE64-ENCODED-ID-TOKEN>,
        "expires_in": 31535999,
        "token_type": "Bearer",
        "scope": "profile openid email permissions"
    }

where the value of BASE64-ENCODED-ID-TOKEN decodes to::

    {
        "family_name": "User1",
        "administrator": false,
        "sub": "foo",
        "iss": "http://localhost:18000/oauth2",
        "user_tracking_id": 1234,
        "preferred_username": "user1",
        "name": "User 1",
        "locale": "en",
        "given_name": "User 1",
        "exp": 1516757075,
        "iat": 1516753475,
        "email": "user1@edx.org",
        "aud": "bar"
    }

However, OpenID Connect is a large standard with many features and is not supported by
the DOT_ implementation.

.. _OpenID Connect: http://openid.net/connect/
.. _ID Token: http://openid.net/specs/openid-connect-core-1_0.html#IDToken
.. _DOP: https://github.com/caffeinehit/django-oauth2-provider
.. _DOT: https://github.com/evonove/django-oauth-toolkit

Decision
--------

Remove our dependency on OpenID Connect since we don't really need all its
features and it isn't supported by DOT. Instead, support `JSON Web Token (JWT)`_,
which is a simpler standard and integrates well with the OAuth2 protocol.

.. _JSON Web Token (JWT): https://jwt.io/

The simplest approach is to allow OAuth2 clients to request JWT tokens in place
of randomly generated Bearer tokens. JWT tokens contain user information,
replacing the need for OpenID's ID Tokens altogether.

JWT Authentication Library
~~~~~~~~~~~~~~~~~~~~~~~~~~

Use the open source `Django Rest Framework JWT library`_ as the backend
implementation for JWT token type authentication.

.. _Django Rest Framework JWT library: https://getblimp.github.io/django-rest-framework-jwt/

JWT Tokens
~~~~~~~~~~

An OAuth2 client requesting a JWT token_type::

    curl -X POST -d "client_id=abc&client_secret=def&grant_type=client_credentials&token_type=jwt" hhttp://localhost:18000/oauth2/access_token/

would now receive::

    {
        "access_token": <BASE64-ENCODED-JWT>,
        "token_type": "JWT",
        "expires_in": 31535999,
        "scope": "read write profile email"
    }

where the value of BASE64-ENCODED-JWT decodes to what the BASE64-ENCODED-ID-TOKEN
decodes to. There would no longer be a separate id_token field, but the
access_token will now contain the data that would have been in the id_token.

**Note:** In order to use the JWT token type to access an API, the Authorization
header needs to specify JWT instead of Bearer:: 

    curl -H "Authorization: JWT <BASE64-ENCODED-JWT>" http://localhost:18000/api/user/v1/me

Bearer Tokens
~~~~~~~~~~~~~

OAuth2 Clients that are not interested in receiving JWT tokens may continue to
use the default Bearer token type::

    curl -X POST -d "client_id=abc&client_secret=def&grant_type=client_credentials" http://localhost:18000/oauth2/access_token/

which returns::

    {
        "access_token": <RANDOMLY-GENERATED-ACCESS-TOKEN>,
        "token_type": "Bearer",
        "expires_in": 36000,
        "scope": "read write profile email"
    }

**Note:** In order to use the Bearer token type to access an API, the Authorization
header specifies Bearer:: 

    curl -H "Authorization: Bearer <RANDOMLY-GENERATED-ACCESS-TOKEN>" http://localhost:18000/api/user/v1/me

Consequences
------------

Pluses
~~~~~~

* The long-term design of the system will be simpler by using simpler
  protocols and frameworks, such as JWT as access tokens.

* OAuth Clients obtain basic identity information within the JWT access
  token without needing to hit an extra user info endpoint.

* Any microservice can validate the JWT as an assertion without making an
  extra round trip to the LMS.

Minuses
~~~~~~~

* Token invalidation and single Logout become more difficult.

* During the transition period, there will be multiple implementations,
  which may result in confusion and a more complex system. The shorter
  we keep the transition period, the better.
