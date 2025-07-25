import { DeepPartial } from 'redux';
import { MockedReduxStoreProvider } from '../../../common/utils/TestUtils';
import { waitFor, renderWithIntl, screen, within } from '@mlflow/mlflow/src/common/utils/TestUtils.react18';
import { RunViewOverview } from './RunViewOverview';
import { ReduxState } from '../../../redux-types';
import { MemoryRouter } from '../../../common/utils/RoutingUtils';
import { cloneDeep, merge } from 'lodash';
import userEvent from '@testing-library/user-event';
import { getRunApi, setTagApi } from '../../actions';
import { usePromptVersionsForRunQuery } from '../../pages/prompts/hooks/usePromptVersionsForRunQuery';
import { NOTE_CONTENT_TAG } from '../../utils/NoteUtils';
import { DesignSystemProvider } from '@databricks/design-system';
import { EXPERIMENT_PARENT_ID_TAG } from '../experiment-page/utils/experimentPage.common-utils';
import type { RunInfoEntity } from '../../types';
import { KeyValueEntity } from '../../../common/types';
import { TestApolloProvider } from '../../../common/utils/TestApolloProvider';
import { QueryClient, QueryClientProvider } from '@mlflow/mlflow/src/common/utils/reactQueryHooks';
import type { LoggedModelProto } from '../../types';
import { type RunPageModelVersionSummary } from './hooks/useUnifiedRegisteredModelVersionsSummariesForRun';
import { useExperimentTrackingDetailsPageLayoutStyles } from '../../hooks/useExperimentTrackingDetailsPageLayoutStyles';
import { LINKED_PROMPTS_TAG_KEY } from '../../pages/prompts/utils';
import { shouldEnableGraphQLRunDetailsPage } from '@mlflow/mlflow/src/common/utils/FeatureUtils';

jest.mock('../../hooks/useExperimentTrackingDetailsPageLayoutStyles', () => ({
  useExperimentTrackingDetailsPageLayoutStyles: jest.fn(),
}));

jest.mock('../../../common/utils/FeatureUtils', () => ({
  ...jest.requireActual<typeof import('../../../common/utils/FeatureUtils')>('../../../common/utils/FeatureUtils'),
  shouldEnableGraphQLRunDetailsPage: jest.fn(),
}));

jest.mock('../../../common/components/Prompt', () => ({
  Prompt: jest.fn(() => <div />),
}));

jest.mock('../../actions', () => ({
  setTagApi: jest.fn(() => ({ type: 'setTagApi', payload: Promise.resolve() })),
  getRunApi: jest.fn(() => ({ type: 'getRunApi', payload: Promise.resolve() })),
}));

const testPromptName = 'test-prompt';
const testPromptVersion = 1;
const testPromptName2 = 'test-prompt-2';

jest.mock('../../pages/prompts/hooks/usePromptVersionsForRunQuery', () => ({
  usePromptVersionsForRunQuery: jest.fn(() => ({
    data: {
      model_versions: [
        {
          name: testPromptName,
          version: testPromptVersion,
        },
      ],
    },
  })),
}));

jest.setTimeout(30000); // Larget timeout for integration testing

const testRunUuid = 'test-run-uuid';
const testRunName = 'Test run name';
const testExperimentId = '12345';

const testRunInfo = {
  artifactUri: 'file:/mlflow/tracking/12345/artifacts',
  startTime: 1672578000000, // 2023-01-01 14:00:00
  endTime: 1672578300000, // 2023-01-01 14:05:00
  experimentId: testExperimentId,
  lifecycleStage: 'active',
  runName: testRunName,
  runUuid: testRunUuid,
  status: 'FINISHED' as const,
};

const testEntitiesState: Partial<ReduxState['entities']> = {
  tagsByRunUuid: {
    [testRunUuid]: {},
  },
  runInfosByUuid: {
    [testRunUuid]: testRunInfo,
  },
  runDatasetsByUuid: {
    [testRunUuid]: [],
  },
  paramsByRunUuid: {
    [testRunUuid]: {
      param_a: { key: 'param_a', value: 'param_a_value' },
      param_b: { key: 'param_b', value: 'param_b_value' },
      param_c: { key: 'param_c', value: 'param_c_value' },
    } as any,
  },
  latestMetricsByRunUuid: {
    [testRunUuid]: {
      metric_1: { key: 'metric_1', value: 'metric_1_value' },
      metric_2: { key: 'metric_2', value: 'metric_2_value' },
      metric_3: { key: 'metric_3', value: 'metric_3_value' },
    } as any,
  },
  modelVersionsByRunUuid: {
    [testRunUuid]: [],
  },
};

describe('RunViewOverview integration', () => {
  const onRunDataUpdated = jest.fn();

  beforeEach(() => {
    jest.mocked<any>(useExperimentTrackingDetailsPageLayoutStyles).mockReturnValue({
      usingUnifiedDetailsLayout: false,
    });
    jest.mocked(shouldEnableGraphQLRunDetailsPage).mockReturnValue(false);
  });
  const renderComponent = ({
    tags = {},
    runInfo,
    reduxStoreEntities = {},
    loggedModelsV3,
    registeredModelVersionSummaries = [],
  }: {
    tags?: Record<string, KeyValueEntity>;
    reduxStoreEntities?: DeepPartial<ReduxState['entities']>;
    runInfo?: Partial<RunInfoEntity>;
    registeredModelVersionSummaries?: RunPageModelVersionSummary[];
    loggedModelsV3?: LoggedModelProto[] | undefined;
  } = {}) => {
    const state: DeepPartial<ReduxState> = {
      entities: merge(
        cloneDeep(testEntitiesState),
        {
          tagsByRunUuid: {
            [testRunUuid]: tags,
          },
        },
        reduxStoreEntities,
      ),
    };

    const queryClient = new QueryClient();

    return renderWithIntl(
      <DesignSystemProvider>
        <QueryClientProvider client={queryClient}>
          <MockedReduxStoreProvider state={state}>
            <TestApolloProvider>
              <MemoryRouter>
                <RunViewOverview
                  onRunDataUpdated={onRunDataUpdated}
                  runUuid={testRunUuid}
                  latestMetrics={testEntitiesState.latestMetricsByRunUuid?.[testRunUuid] || {}}
                  params={testEntitiesState.paramsByRunUuid?.[testRunUuid] || {}}
                  runInfo={{ ...testRunInfo, ...runInfo }}
                  tags={merge({}, testEntitiesState.tagsByRunUuid?.[testRunUuid], tags) || {}}
                  registeredModelVersionSummaries={registeredModelVersionSummaries}
                  loggedModelsV3={loggedModelsV3}
                />
              </MemoryRouter>
            </TestApolloProvider>
          </MockedReduxStoreProvider>
        </QueryClientProvider>
      </DesignSystemProvider>,
    );
  };
  test('Render component in the simplest form and assert minimal set of values', async () => {
    renderComponent();

    // Empty description
    expect(screen.getByText('No description')).toBeInTheDocument();

    // Start time
    expect(screen.getByRole('row', { name: /Created at\s+01\/01\/2023, 01:00:00 PM/ })).toBeInTheDocument();

    // Status
    expect(screen.getByRole('row', { name: /Status\s+Finished/ })).toBeInTheDocument();

    // Run ID
    expect(screen.getByRole('row', { name: /Run ID\s+test-run-uuid/ })).toBeInTheDocument();

    // Duration
    expect(screen.getByRole('row', { name: /Duration\s+5\.0min/ })).toBeInTheDocument();

    // Datasets
    expect(screen.getByRole('row', { name: /Datasets used\s+—/ })).toBeInTheDocument();

    await waitFor(() => {
      // Logged models
      expect(screen.getByRole('row', { name: /Logged models\s+—/ })).toBeInTheDocument();
    });

    // Registered models
    expect(screen.getByRole('row', { name: /Registered models\s+—/ })).toBeInTheDocument();

    // Experiment ID
    expect(screen.getByRole('row', { name: /Experiment ID\s12345/ })).toBeInTheDocument();
  });
  test('Render and change run description', async () => {
    renderComponent({
      tags: {
        [NOTE_CONTENT_TAG]: { key: NOTE_CONTENT_TAG, value: 'existing description' },
      },
    });

    // Non-empty description
    expect(screen.getByText('existing description')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Edit description' }));
    await userEvent.clear(screen.getByTestId('text-area'));
    await userEvent.type(screen.getByTestId('text-area'), 'hello');
    await userEvent.click(screen.getByTestId('editable-note-save-button'));

    expect(setTagApi).toHaveBeenCalledWith('test-run-uuid', NOTE_CONTENT_TAG, 'hello');
  });

  test.each([
    ['200ms', 30, 230],
    ['1.0s', 1000, 2000],
    ['1.5min', 500, 90500],
    ['1.3h', 10, 4500010],
  ])('Properly render %s formatted run duration', (expectedDuration, startTime, endTime) => {
    renderComponent({
      runInfo: { startTime, endTime },
    });

    expect(screen.getByRole('cell', { name: expectedDuration })).toBeInTheDocument();
  });

  test("Render cell with run's author", () => {
    renderComponent({
      tags: {
        'mlflow.user': { key: 'mlflow.user', value: 'test.joe@databricks.com' },
      },
    });

    expect(screen.getByRole('cell', { name: 'test.joe@databricks.com' })).toBeInTheDocument();
  });

  test('Render cell with logged models and display dropdown menu', async () => {
    renderComponent({
      runInfo: {
        artifactUri: 'file:/mlflow/tracking/12345/artifacts',
      },
      tags: {
        'mlflow.log-model.history': {
          key: 'mlflow.log-model.history',
          value: JSON.stringify([
            {
              artifact_path: 'path/to/model',
              flavors: { sklearn: {} },
              utc_time_created: 1672578000000,
            },
            {
              artifact_path: 'path/to/xgboost/model',
              flavors: { xgboost: {} },
              utc_time_created: 1672578000000,
            },
          ]),
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('cell', { name: /sklearn/ })).toBeInTheDocument();
    });

    const modelsCell = screen.getByRole('cell', { name: /sklearn/ });

    expect(modelsCell).toBeInTheDocument();
    expect(within(modelsCell).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringMatching(/test-run-uuid\/artifacts\/path\/to\/model$/),
    );
    expect(within(modelsCell).getByRole('button', { name: '+1' })).toBeInTheDocument();

    await userEvent.click(within(modelsCell).getByRole('button', { name: '+1' }));

    expect(screen.getByText('xgboost')).toBeInTheDocument();
  });

  test('Render cell with registered models and display dropdown menu', async () => {
    renderComponent({
      runInfo: {
        artifactUri: 'file:/mlflow/tracking/12345/artifacts',
      },
      registeredModelVersionSummaries: [
        {
          displayedName: 'test-registered-model',
          version: '1',
          link: '/models/test-registered-model/versions/1',
          source: 'file:/mlflow/tracking/12345/artifacts',
          status: 'READY',
        },
        {
          displayedName: 'another-test-registered-model',
          version: '2',
          link: '/models/another-test-registered-model/versions/2',
          source: 'file:/mlflow/tracking/12345/artifacts',
          status: 'READY',
        },
      ],
      tags: {},
    });

    await waitFor(() => {
      expect(screen.getByRole('cell', { name: /test-registered-model/ })).toBeInTheDocument();
    });

    const modelsCell = screen.getByRole('cell', { name: /test-registered-model/ });

    expect(modelsCell).toBeInTheDocument();
    expect(within(modelsCell).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringMatching(/test-registered-model\/versions\/1$/),
    );

    expect(within(modelsCell).getByRole('button', { name: '+1' })).toBeInTheDocument();

    await userEvent.click(within(modelsCell).getByRole('button', { name: '+1' }));

    expect(screen.getByText('another-test-registered-model')).toBeInTheDocument();
  });

  test('Render child run and check for the existing parent run link', async () => {
    const testParentRunUuid = 'test-parent-run-uuid';
    const testParentRunName = 'Test parent run name';

    renderComponent({
      tags: {
        [EXPERIMENT_PARENT_ID_TAG]: {
          key: EXPERIMENT_PARENT_ID_TAG,
          value: testParentRunUuid,
        } as KeyValueEntity,
      },
      runInfo: {},
      reduxStoreEntities: {
        runInfosByUuid: {
          [testParentRunUuid]: {
            experimentId: testExperimentId,
            runUuid: testParentRunUuid,
            runName: testParentRunName,
          },
        },
      },
    });

    expect(screen.getByRole('row', { name: /Parent run\s+Test parent run name/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Test parent run name/ })).toBeInTheDocument();
  });

  test('Render child run and load the parent run name if it does not exist', async () => {
    const testParentRunUuid = 'test-parent-run-uuid';

    renderComponent({
      tags: {
        [EXPERIMENT_PARENT_ID_TAG]: {
          key: EXPERIMENT_PARENT_ID_TAG,
          value: testParentRunUuid,
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByText('Parent run name loading')).toBeInTheDocument();
      expect(getRunApi).toHaveBeenCalledWith(testParentRunUuid);
    });
  });

  test('Run overview contains prompts', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(`${testPromptName} (v${testPromptVersion})`)).toBeInTheDocument();
      expect(usePromptVersionsForRunQuery).toHaveBeenCalledWith({ runUuid: testRunUuid });
    });
  });

  test('Run overview contains prompts from run tags', async () => {
    renderComponent({
      tags: {
        [LINKED_PROMPTS_TAG_KEY]: {
          key: LINKED_PROMPTS_TAG_KEY,
          value: JSON.stringify([{ name: testPromptName2, version: testPromptVersion.toString() }]),
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByText(`${testPromptName2} (v${testPromptVersion})`)).toBeInTheDocument();
    });
  });

  test('Run overview contains prompts from prompt version tags', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(`${testPromptName} (v${testPromptVersion})`)).toBeInTheDocument();
      expect(usePromptVersionsForRunQuery).toBeCalledWith({ runUuid: testRunUuid });
    });
  });

  // TODO: expand integration tests when tags, params, metrics and models are complete
});
