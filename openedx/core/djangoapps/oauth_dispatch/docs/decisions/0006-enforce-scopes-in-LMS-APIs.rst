6. Enforce Scopes in LMS APIs
-----------------------------

Status
------

Proposed

Context
-------

Although external edX clients, as Restricted Applications, can use edX
as an Identity Provider, they cannot make any API calls on behalf of 
users. In addition, server-to-server calls via the Client Credentials
grant type is also limiting as our API endpoints do not allow organizations
to access data for their own users. The lack of OAuth2 Scopes enforcement
by our API endpoints prevents us from lifting these constraints.

For additional background information on the current implementation,
see the README_.

.. _README: ../README.rst

Decisions
---------

Add support for enforcing OAuth2 scopes by making the following advancements simultaneously.

1. Define and configure new OAuth2 Scopes for accessing API resources
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

* For now, we will start with an initial set of OAuth2 Scopes based on
  immediate API needs.

* OAuth2 clients should be frugal about limiting the scopes they request
  in order to:

  * keep the data payload small
  * keep the UX of the user approval form reasonable
  * follow principle of least priviledge

2. Restricted Applications receive *unexpired* JWTs, signed with a *new key*
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

* We will no longer return expired *JWTs as access tokens* to Restricted
  Applications. We will sign them with a *new key* that is not shared with 
  unprotected microservices.

* API endpoints that are exposed by other microservices and that
  support OAuth2 requests are vulnerable to exploitation until
  they are also updated to enforce scopes.

* We do not want a lock-step deployment across all of our microservices.
  We want to enable these changes without blocking on updating all 
  microservices.

* We do not want to issue unexpired *Bearer tokens* to Restricted
  Applications since they will be accepted by unprotected microservices.
  There's no way to retroactively inform existing microservices
  to reject scope-limiting *Bearer tokens*. (**Note to MS:** This differs
  from your PR.)

* On the other hand, existing unprotected microservices will reject
  *JWT tokens* signed with new keys that they do not know about. We will
  make the new keys available to a microservice only after they
  have been updated to enforce OAuth Scopes. (**Note to MS:** see details
  in this section.)

  * edx_rest_framework_extensions.settings_ supports having a list of
    JWT_ISSUERS instead of just a single one.

  * The `edx-platform settings`_ will be updated to have a list of
    JWT_ISSUERS instead of a single JWT_ISSUER in its settings (example_).
    A separate settings field will keep track of which is the new issuer
    key that is to be used for signing tokens for Restricted Application.

  * oauth_dispatch.views.AccessTokenView.dispatch_ will be updated to
    pass the new JWT key to JwtBuilder_, but only if

    * the requested token_type is *"jwt"* and
    * the access token is associated with a Restricted Application.

  * oauth_dispatch.validators_ will be updated to return *unexpired*
    JWT tokens for Restricted Applications, but ONLY if:

    * the token_type in the request equals *"jwt"* and
    * a `feature toggle (switch)`_ named "oauth2.unexpired_restricted_applications" is enabled.

.. _edx_rest_framework_extensions.settings: https://github.com/edx/edx-drf-extensions/blob/1db9f5e3e5130a1e0f43af2035489b3ed916d245/edx_rest_framework_extensions/settings.py#L73
.. _edx-platform settings: https://github.com/edx/edx-platform/blob/master/lms/envs/docs/README.rst
.. _example: https://github.com/edx/edx-drf-extensions/blob/1db9f5e3e5130a1e0f43af2035489b3ed916d245/test_settings.py#L51
.. _oauth_dispatch.views.AccessTokenView.dispatch: https://github.com/edx/edx-platform/blob/d21a09828072504bc97a2e05883c1241e3a35da9/openedx/core/djangoapps/oauth_dispatch/views.py#L100
.. _oauth_dispatch.validators: https://github.com/edx/edx-platform/blob/master/openedx/core/djangoapps/oauth_dispatch/dot_overrides/validators.py

3. Associate Available Scopes with Applications
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

(**Note to MS:** This seems to be the DOT recommended way of adding 
available scopes support.)

* In order to allow open edX operators to a priori limit the
  types of access an Application can request, we will allow them
  to configure Application-specific "available scopes".

* Introduce a new data model that associates available scopes with
  DOT Applications.

* Introduce a new Scopes Backend that extends DOT's SettingsScopes_
  backend and overrides the implementation of get_available_scopes_.

* The new backend will query the new data model to retrieve
  available scopes.

.. _get_available_scopes: https://github.com/evonove/django-oauth-toolkit/blob/2129f32f55cda950ef220c130dc7de55bea29caf/oauth2_provider/scopes.py#L17
.. _SettingsScopes: https://github.com/evonove/django-oauth-toolkit/blob/2129f32f55cda950ef220c130dc7de55bea29caf/oauth2_provider/scopes.py#L39

4. Associate Available Organizations with Applications
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

(**Note to MS:**  Some details here are different from the implementation
in your PR. See further explanations in the Consequences section below.)

* In order to allow Applications to access data for their own
  organization without inadvertently or maliciously gaining access
  to data for other organizations, Applications need to be
  linked to their own organization. To support this, open edX 
  operators can configure Application-specific "available organizations",
  which are akin to Application-specific "available scopes".

* Introduce a new data model that associates available organizations
  with DOT Applications.

* The new data model will have a Foreign Key to the Organization_ table.
  It will essentially be a many-to-many relationship between Organizations
  and DOT Applications.

* The organization associated with the Application will be included
  in the JWT tokens requested by the Application.

  * JwtBuilder_'s *build_token* functionality will be extended to include
    the organization value in the token's payload. This payload is
    cryptographically signed and so binds and limits the scopes in the
    token to the organization.

  * Since the organization value is in the token, any relying parties
    that receive the token (including microservices) will be able to
    enforce the scopes as limited to the organization.

* **Question:** Should we distinguish between user_org and course_org?  
  The former is the Enterprise relationship while the latter is the
  content provider relationship.  In the future, we will also have
  sponsorship relationship. This depends on whether large organizations
  will want to compartmentalize their Applications.

.. _Organization: https://github.com/edx/edx-organizations/blob/fa137881be9b7d330062bc32655a00c68635cfed/organizations/models.py#L14

5. Introduce a new Permission class to enforce scopes
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

* The new `custom Permission`_ class will extend DOT's TokenHasScope_
  Permission class.

* The TokenHasScope_ permission allows API endpoints to declare the
  scopes that they require in a *required_scopes* class variable.

* The permission class will verify that the scopes in the provided JWT
  are a proper superset of the scopes required by the requested view.

* For now, the permission class will skip this verification if the
  application is not a Restricted Application or if the token_type
  was not a JWT token.

  * **Question:** This will be an issue when microservices want to verify
    scopes. Determining whether an access token is associated with a 
    Restricted Application is an LMS-specific capability. Given this, how 
    can we roll this out eventually to microservices? Do we need to
    include a field in the token that indicates whether it was issued
    to a Restricted Application?

* If the scopes verify, the permission class will update the request
  object with any organization values found in the token in an attribute
  called *allowed_organizations*. The view can then limit its access
  and resources by the allowed organizations. (**Note to MS:** This is
  a change from the PR implementation.)

* In order to have higher confidence that we don't inadvertently miss
  protecting any API endpoints, add the new Permission class to the
  `REST_FRAMEWORK's DEFAULT_PERMISSION_CLASSES`_ setting.

* In case of an unexpected failure with this approach in production,
  use a `feature toggle (switch)`_ named "oauth2.enforce_token_scopes".
  When the switch is disabled, the new Permission class fails verification
  of all Restricted Application requests.
     
.. _custom Permission: http://www.django-rest-framework.org/api-guide/permissions/#custom-permissions
.. _TokenHasScope: https://github.com/evonove/django-oauth-toolkit/blob/50e4df7d97af90439d27a73c5923f2c06a4961f2/oauth2_provider/contrib/rest_framework/permissions.py#L13
.. _`REST_FRAMEWORK's DEFAULT_PERMISSION_CLASSES`: http://www.django-rest-framework.org/api-guide/permissions/#setting-the-permission-policy

Consequences
------------

* Putting these changes behind a feature toggle allows us to decouple 
  release from deployment and disable these changes in the event of
  unexpected issues. 
  
  * Minimizing the places that the feature toggle is checked (at the
    time of returning unexpired tokens and at the time of validating
    requests), minimizes the complexity of the code.

* By associating Scopes and Organizations with DOT Applications and not
  Restricted Applications, we can eventually eliminate Restricted
  Applications altogether. Besides, they were introduced as a temporary
  concept until Scopes were fully rolled out.

* By including the organization value in the token, any relying parties
  that receive the token (including microservices) will be able to
  enforce the scopes as limited to the organization.

* Microservices will continue to have limited scope support. We are
  consciously deciding to not address them at this time. When we do,
  we will also want to simplify and consolidate their OAuth-related
  logic and code.

.. _feature toggle (switch): https://openedx.atlassian.net/wiki/spaces/OpenDev/pages/40862688/Feature+Flags+and+Settings+on+edx-platform#FeatureFlagsandSettingsonedx-platform-Case1:Decouplingreleasefromdeployment
.. _JwtBuilder: https://github.com/edx/edx-platform/blob/d3d64970c36f36a96d684571ec5b48ed645618d8/openedx/core/lib/token_utils.py#L15